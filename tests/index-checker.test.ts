import { describe, it, expect } from 'vitest';
import { scanTestVault } from './test-vault.js';
import { checkIndexes, indexReportHasIssues } from '../src/index-checker.js';
import type { IndexReport, VaultFile, WikiLink } from '../src/types.js';

async function findFolderCReport(): Promise<IndexReport> {
  const scan = await scanTestVault();
  const reports = checkIndexes(scan, 2);

  const folderCReport = reports.find(
    (r) => r.indexFile.relativePath === 'FolderC/Index.md',
  );
  expect(folderCReport).toBeDefined();
  return folderCReport!;
}

describe('checkIndexes', () => {
  it('finds Index and Overview files', async () => {
    const scan = await scanTestVault();
    const reports = checkIndexes(scan, 2);

    // Should find: FolderA/Overview.md, FolderB/Overview.md, FolderC/Index.md
    expect(reports.length).toBe(3);

    const names = reports.map((r) => r.indexFile.relativePath).sort();
    expect(names).toContain('FolderA/Overview.md');
    expect(names).toContain('FolderB/Overview.md');
    expect(names).toContain('FolderC/Index.md');
  });

  it('detects missing links in FolderC/Index.md', async () => {
    const folderCReport = await findFolderCReport();

    // "Unlisted Page" is in FolderC but not linked from Index.md
    const missingNames = folderCReport.missingLinks.map((f) => f.name);
    expect(missingNames).toContain('Unlisted Page');
  });
});

describe('checkIndexes', () => {
  it('detects stale links in FolderC/Index.md', async () => {
    const folderCReport = await findFolderCReport();

    // [[Gone Page]] doesn't exist anywhere
    const staleTargets = folderCReport.staleLinks.map((l) => l.target);
    expect(staleTargets).toContain('Gone Page');
  });

  it('does not flag cross-scope links as stale', async () => {
    const scan = await scanTestVault();
    const reports = checkIndexes(scan, 2);

    const folderAReport = reports.find(
      (r) => r.indexFile.relativePath === 'FolderA/Overview.md',
    );
    expect(folderAReport).toBeDefined();

    // [[Page One]] exists in FolderA, so Overview.md is linking correctly
    expect(folderAReport!.staleLinks).toHaveLength(0);
  });
});

describe('indexReportHasIssues', () => {
  const indexFile: VaultFile = {
    relativePath: 'Folder/Index.md',
    name: 'Index',
    absolutePath: '/vault/Folder/Index.md',
  };

  it('returns false when no missing or stale links', () => {
    const report: IndexReport = {
      indexFile,
      missingLinks: [],
      staleLinks: [],
    };
    expect(indexReportHasIssues(report)).toBe(false);
  });

  it('returns true when missing links exist', () => {
    const report: IndexReport = {
      indexFile,
      missingLinks: [
        { relativePath: 'a.md', name: 'a', absolutePath: '/a.md' },
      ],
      staleLinks: [],
    };
    expect(indexReportHasIssues(report)).toBe(true);
  });

  it('returns true when stale links exist', () => {
    const link: WikiLink = {
      raw: '[[X]]',
      target: 'X',
      alias: null,
      isEmbed: false,
      line: 1,
      sourceFile: 'Index.md',
    };
    const report: IndexReport = {
      indexFile,
      missingLinks: [],
      staleLinks: [link],
    };
    expect(indexReportHasIssues(report)).toBe(true);
  });
});
