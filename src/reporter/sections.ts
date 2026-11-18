/**
 * Report section builders. Each pushXxxSection() appends lines for one part of the
 * markdown report. Used by reporter.ts generateReport().
 */

import { stripMdExtension } from '../vault-fs/vault-files.js';
import type {
  AISuggestion,
  IndexReport,
  LinkResolution,
  ReportData,
} from '../types.js';

function pathToWikiLink(path: string): string {
  return `[[${stripMdExtension(path)}]]`;
}

function targetToCode(target: string): string {
  return `\`[[${target}]]\``;
}

interface OptionalTable<T> {
  title: string;
  emptyMessage: string;
  header: string;
  separator: string;
  items: T[];
  rowFn: (item: T) => string;
}

function pushOptionalTable<T>(lines: string[], table: OptionalTable<T>): void {
  lines.push('', table.title, '');
  if (table.items.length === 0) {
    lines.push(table.emptyMessage);
  } else {
    lines.push(table.header, table.separator);
    for (const item of table.items) lines.push(table.rowFn(item));
  }
}

export interface ReportHeader {
  dateStr: string;
  ts: string;
  totalFiles: number;
  totalLinks: number;
}

export function pushHeaderSection(lines: string[], header: ReportHeader): void {
  lines.push('# Vault maintenance report');
  lines.push('');
  lines.push(`## 🗓️ ${header.dateStr} ${header.ts}`);
  lines.push('');
  lines.push(
    `Scanned ${header.totalFiles} files. Found ${header.totalLinks} links.`,
  );
  lines.push('');
}

export function pushBrokenLinksSection(
  lines: string[],
  brokenLinks: LinkResolution[],
): void {
  pushOptionalTable(lines, {
    title: `## 🔗 Broken links (${brokenLinks.length})`,
    emptyMessage: 'None found.',
    header: '| Source | Broken link | Line |',
    separator: '|--------|-------------|------|',
    items: brokenLinks,
    rowFn: (r: LinkResolution) =>
      `| ${pathToWikiLink(r.link.sourceFile)} | ${targetToCode(r.link.target)} | ${r.link.line} |`,
  });
}

export function pushAISuggestionsSection(
  lines: string[],
  aiSuggestions: AISuggestion[],
): void {
  if (aiSuggestions.length === 0) return;
  lines.push('');
  lines.push('### 🧠 AI suggestions');
  lines.push('');
  lines.push('| Broken link | Suggested target | Confidence |');
  lines.push('|-------------|-----------------|------------|');
  for (const s of aiSuggestions) {
    lines.push(
      `| ${targetToCode(s.brokenLink.target)} | ${pathToWikiLink(s.suggestedTarget)} | ${s.confidence.toFixed(2)} |`,
    );
  }
}

export function pushAmbiguousLinksSection(
  lines: string[],
  ambiguousLinks: LinkResolution[],
): void {
  pushOptionalTable(lines, {
    title: `## 🔀 Ambiguous links (${ambiguousLinks.length})`,
    emptyMessage: 'None found.',
    header: '| Source | Link | Possible targets |',
    separator: '|--------|------|-----------------|',
    items: ambiguousLinks,
    rowFn: (r: LinkResolution) => {
      const targets = r.candidates
        .map((c) => stripMdExtension(c.relativePath))
        .join(', ');
      return `| ${pathToWikiLink(r.link.sourceFile)} | ${targetToCode(r.link.target)} | ${targets} |`;
    },
  });
}

export function pushStaleIndexesSection(
  lines: string[],
  reportsWithIssues: IndexReport[],
): void {
  const staleCount = reportsWithIssues.length;

  lines.push('');
  lines.push(`## 📘 Stale indexes (${staleCount})`);
  lines.push('');

  if (staleCount === 0) {
    lines.push('All indexes are up to date.');
  } else {
    for (const report of reportsWithIssues) {
      lines.push(`### ${report.indexFile.relativePath}`);

      if (report.missingLinks.length > 0) {
        lines.push('Missing links to:');
        for (const f of report.missingLinks) {
          lines.push(`- [ ] \`${f.name}\` (exists in folder, not linked)`);
        }
      }

      if (report.staleLinks.length > 0) {
        lines.push('Stale links:');
        for (const l of report.staleLinks) {
          lines.push(
            `- [ ] ${targetToCode(l.target)} (linked but file does not exist)`,
          );
        }
      }
      lines.push('');
    }
  }
}

export function pushSummarySection(
  lines: string[],
  data: ReportData,
  staleCount: number,
): void {
  lines.push('');
  lines.push('## ✅ Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total files | ${data.totalFiles} |`);
  lines.push(`| Total links | ${data.totalLinks} |`);
  lines.push(`| Broken links | ${data.brokenLinks.length} |`);
  lines.push(`| Ambiguous links | ${data.ambiguousLinks.length} |`);
  lines.push(`| Stale indexes | ${staleCount} |`);
  lines.push('');
}
