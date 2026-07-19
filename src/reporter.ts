/**
 * Report generation and writing. generateReport() composes sections (see reporter/sections.ts)
 * into one markdown string; writeReport() writes it to the vault with a date-based filename.
 */

import { join } from "node:path";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { indexReportHasIssues } from "./index-checker.js";
import { isValidDate, toISODateString } from "./utils/fs-helpers.js";
import {
  pushHeaderSection,
  pushBrokenLinksSection,
  pushAISuggestionsSection,
  pushAmbiguousLinksSection,
  pushStaleIndexesSection,
  pushSummarySection,
} from "./reporter/sections.js";
import type { ReportData } from "./types.js";

/** Build the full markdown report from report data. */
export function generateReport(data: ReportData): string {
  const lines: string[] = [];
  const ts = formatTimestamp(data.timestamp);
  const dateStr = toISODateString(data.timestamp);
  const reportsWithIssues = data.indexReports.filter(indexReportHasIssues);

  pushHeaderSection(lines, dateStr, ts, data.totalFiles, data.totalLinks);
  pushBrokenLinksSection(lines, data.brokenLinks);
  pushAISuggestionsSection(lines, data);
  pushAmbiguousLinksSection(lines, data.ambiguousLinks);
  pushStaleIndexesSection(lines, data, reportsWithIssues);
  pushSummarySection(lines, data, reportsWithIssues.length);

  return lines.join("\n");
}

/**
 * Write the report to the vault. Returns the written file path.
 * Handles same-day counter suffix (-2, -3, etc.).
 */
export async function writeReport(
  report: string,
  vaultPath: string,
  reportFolder: string,
  timestamp: Date,
): Promise<string> {
  const reportDir = join(vaultPath, reportFolder);
  await mkdir(reportDir, { recursive: true });

  const dateStr = toISODateString(timestamp);
  let filename = `${dateStr}.md`;

  const existing = await readdir(reportDir).catch(() => []);
  const sameDayReports = existing.filter(
    (f) => f.startsWith(dateStr) && f.endsWith(".md"),
  );

  if (sameDayReports.length > 0) {
    filename = `${dateStr}-${sameDayReports.length + 1}.md`;
  }

  const filePath = join(reportDir, filename);
  await writeFile(filePath, report, "utf-8");

  return filePath;
}

function formatTimestamp(date: Date): string {
  const d = isValidDate(date) ? date : new Date();
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
