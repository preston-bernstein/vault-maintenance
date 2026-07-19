/**
 * Index/Overview staleness check. Finds Index.md and Overview.md, then for each
 * compares its links to sibling files (missing links) and to the vault (stale links).
 */

import { getMarkdownFiles } from "./scanner.js";
import { groupBy } from "./utils/array-helpers.js";
import { checkSingleIndex } from "./index-checker/check-single.js";
import type { IndexReport, ScanResult } from "./types.js";

/** File names (without extension) that we treat as index/overview pages. */
const INDEX_NAMES = new Set(["Index", "Overview"]);

/** True if the index has missing or stale links. */
export function indexReportHasIssues(report: IndexReport): boolean {
  return report.missingLinks.length > 0 || report.staleLinks.length > 0;
}

/**
 * Find all Index.md and Overview.md files in the vault,
 * then compare their links against files in their parent folder.
 */
export function checkIndexes(scan: ScanResult, depth: number): IndexReport[] {
  const mdFiles = scan.mdFiles ?? getMarkdownFiles(scan);
  const allVaultNames = new Set(scan.files.map((f) => f.name));
  const linksBySource = groupBy(scan.links, (l) => l.sourceFile);
  const indexFiles = mdFiles.filter((f) => INDEX_NAMES.has(f.name));
  const reports: IndexReport[] = [];

  for (const indexFile of indexFiles) {
    const indexLinks = linksBySource.get(indexFile.relativePath) ?? [];
    reports.push(
      checkSingleIndex(indexFile, depth, mdFiles, allVaultNames, indexLinks),
    );
  }

  return reports;
}
