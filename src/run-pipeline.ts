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
} from './utils/logger.js';
import { formatError } from './utils/fs-helpers.js';
import type {
  AISuggestion,
  IndexReport,
  LinkResolution,
  ReportData,
  ScanResult,
} from './types.js';

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
  const includeScan = Boolean(opts.scanOnly);
  const anyPhaseFlag = Boolean(includeScan || opts.analyze || opts.report);
  const readEnabled = includeScan || !anyPhaseFlag;
  const analyzeEnabled = Boolean(opts.analyze) || !anyPhaseFlag;
  const reportEnabled = Boolean(opts.report) || !anyPhaseFlag;

  const runReport = reportEnabled;
  const runAnalyze = analyzeEnabled || (reportEnabled && !opts.input);
  const runRead =
    readEnabled || ((analyzeEnabled || reportEnabled) && !opts.input);

  const lastPhase: PipelinePhase = runReport
    ? 'report'
    : runAnalyze
      ? 'analyze'
      : 'read';

  return { runRead, runAnalyze, runReport, lastPhase };
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

/**
 * Serializes and emits the output of whichever phase ran last, then returns the
 * process exit code for that output. Read/analyze phases write JSON (to --output
 * or stdout); the report phase has its own json/dry-run/write-to-vault branching.
 */
async function emitPhaseOutput(params: EmitPhaseOutputParams): Promise<number> {
  const {
    lastPhase,
    scan,
    reportData,
    opts,
    vaultPath,
    reportFolder,
    verbose,
  } = params;

  if (lastPhase === 'read') {
    if (!scan) return 0;
    const out = serializeScanResult(scan) + '\n';
    if (opts.output) {
      await writeToFile(opts.output, out);
      await log(verbose, `Scan written to: ${opts.output}\n`);
    } else {
      process.stdout.write(out);
    }
    return 0;
  }

  if (lastPhase === 'analyze') {
    if (!reportData) return 0;
    const out = serializeReportData(reportData) + '\n';
    if (opts.output) {
      await writeToFile(opts.output, out);
      await log(verbose, `Analysis written to: ${opts.output}\n`);
    } else {
      process.stdout.write(out);
    }
    return 0;
  }

  // lastPhase === 'report'
  if (!reportData) return 0;
  if (opts.json) {
    process.stdout.write(serializeReportData(reportData) + '\n');
  } else {
    const report = generateReport(reportData);
    if (opts.dryRun) {
      process.stdout.write(report);
    } else {
      const filePath = await writeReport(
        report,
        vaultPath,
        reportFolder,
        reportData.timestamp,
      );
      await log(verbose, `Report written to: ${filePath}\n`);
      process.stdout.write(`Report: ${filePath}\n`);
    }
  }
  return hasReportIssues(
    reportData.brokenLinks,
    reportData.ambiguousLinks,
    reportData.indexReports,
  )
    ? 1
    : 0;
}

export async function runPipeline(opts: PipelineOptions): Promise<number> {
  // Load config and apply CLI overrides
  const config = await loadConfig(opts.configPath);

  if (opts.vault) config.vaultPath = opts.vault.trim() || config.vaultPath;
  if (opts.ai !== undefined) config.ai.enabled = opts.ai;
  if (
    opts.provider &&
    (opts.provider === 'claude' || opts.provider === 'openai')
  ) {
    config.ai.provider = opts.provider;
  }

  const vaultPath = config.vaultPath?.trim();
  if (!vaultPath) {
    throw new Error('Vault path is required');
  }
  config.vaultPath = vaultPath;

  const verbose = opts.verbose ?? false;
  const effectiveLogDir = (opts.logDir ?? config.logDir)?.trim();
  if (effectiveLogDir) await startLogFile(effectiveLogDir, vaultPath);

  let exitCode = 0;
  try {
    const { runRead, runAnalyze, runReport, lastPhase } = resolvePhases(opts);

    let scan: ScanResult | undefined;
    if (runRead) {
      await log(verbose, `Vault: ${config.vaultPath}\n`);
      await log(verbose, 'Scanning vault...\n');
      scan = await scanVault({
        vaultPath,
        excludePatterns: config.excludePatterns,
        verbose,
      });
    } else if (runAnalyze && opts.input) {
      scan = await readScanResultFromFile(opts.input);
      await log(verbose, `Loaded scan from ${opts.input}\n`);
    }

    let reportData: ReportData | undefined;
    if (runAnalyze && scan) {
      await log(verbose, 'Resolving links...\n');
      const resolutions = resolveLinks(scan);
      const { brokenLinks, ambiguousLinks } =
        getBrokenAndAmbiguousLinks(resolutions);
      await log(verbose, 'Checking indexes...\n');
      const indexReports = checkIndexes(scan, config.indexCheckDepth);
      let aiSuggestions: AISuggestion[] = [];
      if (config.ai.enabled && brokenLinks.length > 0) {
        await log(verbose, 'Getting AI suggestions...\n');
        aiSuggestions = await suggestFixes(
          brokenLinks,
          scan,
          config.ai,
          verbose,
        );
      }
      const timestamp = new Date();
      reportData = {
        timestamp,
        totalFiles: scan.mdFiles.length,
        totalLinks: scan.links.length,
        brokenLinks,
        ambiguousLinks,
        indexReports,
        aiSuggestions,
      };
    } else if (runReport && !runAnalyze && opts.input) {
      reportData = await readReportDataFromFile(opts.input);
      await log(verbose, `Loaded analysis from ${opts.input}\n`);
    }

    exitCode = await emitPhaseOutput({
      lastPhase,
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

function hasReportIssues(
  brokenLinks: LinkResolution[],
  ambiguousLinks: LinkResolution[],
  indexReports: IndexReport[],
): boolean {
  return (
    brokenLinks.length > 0 ||
    ambiguousLinks.length > 0 ||
    indexReports.some(indexReportHasIssues)
  );
}
