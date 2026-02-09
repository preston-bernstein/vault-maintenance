/**
 * Runs the vault maintenance pipeline: read (scan) → analyze (resolve, index check, AI) → report.
 * Phase flags are stackable: no flags = full pipeline; one or more of --scan-only, --analyze, --report
 * run only those phases in order; output is the last phase’s result. --input feeds the first phase
 * that needs prior output (scan for analyze, analysis for report). Enact (--apply) is reserved.
 */

import { loadConfig } from './config.js';
import { scanVault, getMarkdownFileCount } from './scanner.js';
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
  /** Include read phase (scan vault). Same effect as --scan. */
  scanOnly?: boolean;
  /** Same as scanOnly (include read phase). */
  scan?: boolean;
  analyze?: boolean;
  report?: boolean;
  input?: string;
  output?: string;
  apply?: boolean;
}

function log(verbose: boolean, message: string): void {
  if (verbose) process.stderr.write(message);
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

  const includeScan = Boolean(opts.scanOnly || opts.scan);
  const anyPhaseFlag = Boolean(includeScan || opts.analyze || opts.report);
  const readEnabled = includeScan || !anyPhaseFlag;
  const analyzeEnabled = opts.analyze || !anyPhaseFlag;
  const reportEnabled = opts.report || !anyPhaseFlag;

  const runRead =
    readEnabled || ((analyzeEnabled || reportEnabled) && !opts.input);
  const runAnalyze =
    analyzeEnabled || (reportEnabled && !opts.input);
  const runReport = reportEnabled;

  let scan: ScanResult | undefined;
  if (runRead) {
    log(verbose, `Vault: ${config.vaultPath}\n`);
    log(verbose, 'Scanning vault...\n');
    scan = await scanVault({
      vaultPath,
      excludePatterns: config.excludePatterns,
      verbose,
    });
  } else if (runAnalyze && opts.input) {
    scan = await readScanResultFromFile(opts.input);
    log(verbose, `Loaded scan from ${opts.input}\n`);
  }

  let reportData: ReportData | undefined;
  if (runAnalyze && scan) {
    log(verbose, 'Resolving links...\n');
    const resolutions = resolveLinks(scan);
    const { brokenLinks, ambiguousLinks } =
      getBrokenAndAmbiguousLinks(resolutions);
    log(verbose, 'Checking indexes...\n');
    const indexReports = checkIndexes(scan, config.indexCheckDepth);
    let aiSuggestions: AISuggestion[] = [];
    if (config.ai.enabled && brokenLinks.length > 0) {
      log(verbose, 'Getting AI suggestions...\n');
      aiSuggestions = await suggestFixes(brokenLinks, scan, config.ai);
    }
    const timestamp = new Date();
    reportData = {
      timestamp,
      totalFiles: scan.mdFiles?.length ?? getMarkdownFileCount(scan),
      totalLinks: scan.links.length,
      brokenLinks,
      ambiguousLinks,
      indexReports,
      aiSuggestions,
    };
  } else if (runReport && !runAnalyze && opts.input) {
    reportData = await readReportDataFromFile(opts.input);
    log(verbose, `Loaded analysis from ${opts.input}\n`);
  }

  const outputLastIsReport = runReport;
  const outputLastIsAnalyze = !runReport && runAnalyze;
  const outputLastIsRead = !runReport && !runAnalyze && runRead;

  if (outputLastIsRead && scan) {
    const out = serializeScanResult(scan) + '\n';
    if (opts.output) {
      await writeToFile(opts.output, out);
      log(verbose, `Scan written to: ${opts.output}\n`);
    } else {
      process.stdout.write(out);
    }
    return 0;
  }

  if (outputLastIsAnalyze && reportData) {
    const out = serializeReportData(reportData) + '\n';
    if (opts.output) {
      await writeToFile(opts.output, out);
      log(verbose, `Analysis written to: ${opts.output}\n`);
    } else {
      process.stdout.write(out);
    }
    return 0;
  }

  if (outputLastIsReport && reportData) {
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
          config.reportFolder,
          reportData.timestamp
        );
        log(verbose, `Report written to: ${filePath}\n`);
        process.stdout.write(`Report: ${filePath}\n`);
      }
    }
    return hasReportIssues(
      reportData.brokenLinks,
      reportData.ambiguousLinks,
      reportData.indexReports
    )
      ? 1
      : 0;
  }

  return 0;
}

// --- Enact phase (future) ---
// Intended flow: read analysis from --input (or run analyze in memory), optionally
// apply AI suggestions or other edits to vault files. Support --dry-run for apply.
// Gated by --apply; not yet implemented (CLI exits 2 when --apply is used).

function hasReportIssues(
  brokenLinks: LinkResolution[],
  ambiguousLinks: LinkResolution[],
  indexReports: IndexReport[]
): boolean {
  return (
    brokenLinks.length > 0 ||
    ambiguousLinks.length > 0 ||
    indexReports.some(indexReportHasIssues)
  );
}
