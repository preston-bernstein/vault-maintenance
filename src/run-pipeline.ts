/**
 * Runs the vault maintenance pipeline: read (scan) → analyze (resolve, index check, AI) → report.
 * Phase flags are stackable: no flags = full pipeline; one or more of --scan-only, --analyze, --report
 * run only those phases in order; output is the last phase’s result. --input feeds the first phase
 * that needs prior output (scan for analyze, analysis for report). Enact (--apply) is reserved.
 */

import { loadConfig } from './config.js';
import { scanVault } from './scanner.js';
import { resolveLinks, getBrokenAndAmbiguousLinks } from './resolver.js';
import { checkIndexes, indexReportHasIssues } from './index-checker.js';
import { generateReport, writeReport } from './reporter.js';
import { suggestFixes } from './ai-suggester.js';
import {
  serializeScanResult,
  serializeReportData,
  readScanResultFromFile,
  readReportDataFromFile,
  writeToFile,
} from './serialization.js';
import {
  startLogFile,
  endLogFile,
  isLogging,
  writeLogLine,
  log,
} from './logging/logger.js';
import { formatError } from './formatting/format.js';
import type { AISuggestion, Config, ReportData, ScanResult } from './types.js';

export interface PipelineOptions {
  configPath?: string;
  vault?: string;
  ai?: boolean;
  provider?: string;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
  /** Include read phase (scan vault). */
  scanOnly?: boolean;
  analyze?: boolean;
  report?: boolean;
  input?: string;
  output?: string;
  /** When set, append run logs to logDir/YYYY/MM/YYYY-MM-DD.log. Overrides config.logDir. */
  logDir?: string;
}

export type PipelinePhase = 'read' | 'analyze' | 'report';

export interface ResolvedPhases {
  runRead: boolean;
  runAnalyze: boolean;
  runReport: boolean;
  lastPhase: PipelinePhase;
}

/**
 * Pure phase-selection logic: which phases run, and which one's output is emitted.
 * No flags = full pipeline (read → analyze → report). One or more phase flags = run
 * only those phases (plus whatever earlier phase is needed to feed them, unless
 * --input supplies that instead).
 */
export function resolvePhases(
  opts: Pick<PipelineOptions, 'scanOnly' | 'analyze' | 'report' | 'input'>,
): ResolvedPhases {
  const anyPhaseFlag = Boolean(opts.scanOnly || opts.analyze || opts.report);
  if (!anyPhaseFlag) {
    return {
      runRead: true,
      runAnalyze: true,
      runReport: true,
      lastPhase: 'report',
    };
  }

  const needsPriorPhase = !opts.input;
  const runReport = Boolean(opts.report);
  const runAnalyze = Boolean(opts.analyze) || (runReport && needsPriorPhase);
  const runRead =
    Boolean(opts.scanOnly) ||
    (Boolean(opts.analyze || opts.report) && needsPriorPhase);

  return {
    runRead,
    runAnalyze,
    runReport,
    lastPhase: lastPhaseOf(runReport, runAnalyze),
  };
}

function lastPhaseOf(runReport: boolean, runAnalyze: boolean): PipelinePhase {
  if (runReport) return 'report';
  return runAnalyze ? 'analyze' : 'read';
}

interface EmitPhaseOutputParams {
  lastPhase: PipelinePhase;
  scan: ScanResult | undefined;
  reportData: ReportData | undefined;
  opts: PipelineOptions;
  vaultPath: string;
  reportFolder: string;
  verbose: boolean;
}

/** Writes serialized JSON to --output, or to stdout when no path is given. */
async function emitJson(
  json: string,
  outputPath: string | undefined,
  label: string,
  verbose: boolean,
): Promise<void> {
  const out = json + '\n';
  if (!outputPath) {
    process.stdout.write(out);
    return;
  }
  await writeToFile(outputPath, out);
  await log(verbose, `${label} written to: ${outputPath}\n`);
}

/** The report phase has its own json, dry-run and write-to-vault branches. */
async function emitReport(
  reportData: ReportData,
  params: EmitPhaseOutputParams,
): Promise<void> {
  if (params.opts.json) {
    process.stdout.write(serializeReportData(reportData) + '\n');
    return;
  }
  const report = generateReport(reportData);
  if (params.opts.dryRun) {
    process.stdout.write(report);
    return;
  }
  const filePath = await writeReport(
    report,
    params.vaultPath,
    params.reportFolder,
    reportData.timestamp,
  );
  await log(params.verbose, `Report written to: ${filePath}\n`);
  process.stdout.write(`Report: ${filePath}\n`);
}

/**
 * Serializes and emits the output of whichever phase ran last, then returns the
 * process exit code for that output. Read/analyze phases write JSON (to --output
 * or stdout); the report phase has its own json/dry-run/write-to-vault branching.
 */
async function emitPhaseOutput(params: EmitPhaseOutputParams): Promise<number> {
  const { lastPhase, scan, reportData, opts, verbose } = params;

  if (lastPhase === 'read') {
    if (scan) {
      await emitJson(serializeScanResult(scan), opts.output, 'Scan', verbose);
    }
    return 0;
  }

  if (!reportData) return 0;

  if (lastPhase === 'analyze') {
    await emitJson(
      serializeReportData(reportData),
      opts.output,
      'Analysis',
      verbose,
    );
    return 0;
  }

  await emitReport(reportData, params);
  return hasReportIssues(reportData) ? 1 : 0;
}

/** Applies CLI overrides to the loaded config and returns the vault path. */
function applyOverrides(config: Config, opts: PipelineOptions): string {
  if (opts.vault) config.vaultPath = opts.vault.trim() || config.vaultPath;
  if (opts.ai !== undefined) config.ai.enabled = opts.ai;
  if (opts.provider === 'claude' || opts.provider === 'openai') {
    config.ai.provider = opts.provider;
  }

  const vaultPath = config.vaultPath?.trim();
  if (!vaultPath) {
    throw new Error('Vault path is required');
  }
  config.vaultPath = vaultPath;
  return vaultPath;
}

/** Exclude patterns plus the report folder, so a report never scans itself. */
function withReportFolderExcluded(config: Config): string[] {
  const reportFolderPattern = `${config.reportFolder}/**`;
  return config.excludePatterns.includes(reportFolderPattern)
    ? config.excludePatterns
    : [...config.excludePatterns, reportFolderPattern];
}

/** Settings every pipeline step reads. */
interface RunContext {
  config: Config;
  opts: PipelineOptions;
  verbose: boolean;
}

/** Gets the scan result: from a fresh vault scan, from --input, or neither. */
async function obtainScan(
  phases: ResolvedPhases,
  ctx: RunContext,
): Promise<ScanResult | undefined> {
  const { config, opts, verbose } = ctx;
  if (phases.runRead) {
    await log(verbose, `Vault: ${config.vaultPath}\n`);
    await log(verbose, 'Scanning vault...\n');
    return scanVault({
      vaultPath: config.vaultPath,
      excludePatterns: withReportFolderExcluded(config),
      verbose,
    });
  }
  if (phases.runAnalyze && opts.input) {
    const scan = await readScanResultFromFile(opts.input);
    await log(verbose, `Loaded scan from ${opts.input}\n`);
    return scan;
  }
  return undefined;
}

/** Resolves links, checks indexes and, when enabled, asks the AI for fixes. */
async function analyzeScan(
  scan: ScanResult,
  ctx: RunContext,
): Promise<ReportData> {
  const { config, verbose } = ctx;
  await log(verbose, 'Resolving links...\n');
  const resolutions = resolveLinks(scan);
  const { brokenLinks, ambiguousLinks } =
    getBrokenAndAmbiguousLinks(resolutions);
  await log(verbose, 'Checking indexes...\n');
  const indexReports = checkIndexes(scan, config.indexCheckDepth);
  let aiSuggestions: AISuggestion[] = [];
  if (config.ai.enabled && brokenLinks.length > 0) {
    await log(verbose, 'Getting AI suggestions...\n');
    aiSuggestions = await suggestFixes(brokenLinks, scan, config.ai, verbose);
  }
  return {
    timestamp: new Date(),
    totalFiles: scan.mdFiles.length,
    totalLinks: scan.links.length,
    brokenLinks,
    ambiguousLinks,
    indexReports,
    aiSuggestions,
  };
}

/** Gets the report data: from a fresh analysis, from --input, or neither. */
async function obtainReportData(
  phases: ResolvedPhases,
  scan: ScanResult | undefined,
  ctx: RunContext,
): Promise<ReportData | undefined> {
  const { opts, verbose } = ctx;
  if (phases.runAnalyze && scan) return analyzeScan(scan, ctx);
  if (phases.runReport && !phases.runAnalyze && opts.input) {
    const reportData = await readReportDataFromFile(opts.input);
    await log(verbose, `Loaded analysis from ${opts.input}\n`);
    return reportData;
  }
  return undefined;
}

export async function runPipeline(opts: PipelineOptions): Promise<number> {
  const config = await loadConfig(opts.configPath);
  const vaultPath = applyOverrides(config, opts);

  const verbose = opts.verbose ?? false;
  const effectiveLogDir = (opts.logDir ?? config.logDir)?.trim();
  if (effectiveLogDir) await startLogFile(effectiveLogDir, vaultPath);

  let exitCode = 0;
  try {
    const phases = resolvePhases(opts);
    const ctx: RunContext = { config, opts, verbose };
    const scan = await obtainScan(phases, ctx);
    const reportData = await obtainReportData(phases, scan, ctx);

    exitCode = await emitPhaseOutput({
      lastPhase: phases.lastPhase,
      scan,
      reportData,
      opts,
      vaultPath,
      reportFolder: config.reportFolder,
      verbose,
    });
    return exitCode;
  } catch (err) {
    exitCode = 2;
    if (isLogging()) {
      await writeLogLine(`Error: ${formatError(err)}`);
    }
    throw err;
  } finally {
    await endLogFile(exitCode);
  }
}

function hasReportIssues(reportData: ReportData): boolean {
  return (
    reportData.brokenLinks.length > 0 ||
    reportData.ambiguousLinks.length > 0 ||
    reportData.indexReports.some(indexReportHasIssues)
  );
}
