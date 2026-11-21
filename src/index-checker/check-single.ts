/**
 * Per-index logic: which files are in scope (by depth) and which links are missing or stale.
 */

import { dirname, relative } from 'node:path';
import { lastPathSegment } from '../vault-fs/vault-files.js';
import type { IndexReport, VaultFile, WikiLink } from '../types.js';

function targetName(link: WikiLink): string {
  return lastPathSegment(link.target);
}

/**
 * True if filePath is within scopeDir within the given depth.
 * Depth = max number of path segments below scopeDir (e.g. depth 2 → same dir or one subdir).
 */
export function isInScope(
  filePath: string,
  scopeDir: string,
  depth: number,
): boolean {
  const rel = scopeDir === '.' ? filePath : relative(scopeDir, filePath);
  if (rel.startsWith('..')) return false;
  let slashCount = 0;
  for (let i = 0; i < rel.length; i++) if (rel[i] === '/') slashCount++;
  return slashCount < depth;
}

/** What every index in one vault is checked against. */
export interface IndexCheckScope {
  depth: number;
  mdFiles: VaultFile[];
  allVaultNames: Set<string>;
}

export function checkSingleIndex(
  indexFile: VaultFile,
  indexLinks: WikiLink[],
  scope: IndexCheckScope,
): IndexReport {
  const { depth, mdFiles, allVaultNames } = scope;
  const indexDir = dirname(indexFile.relativePath);

  const scopeFiles = mdFiles.filter((f) => {
    if (f.relativePath === indexFile.relativePath) return false;
    return isInScope(f.relativePath, indexDir, depth);
  });

  const linkedNames = new Set<string>();
  for (const link of indexLinks) {
    linkedNames.add(targetName(link));
  }

  const missingLinks = scopeFiles.filter((f) => !linkedNames.has(f.name));

  const staleLinks: WikiLink[] = indexLinks.filter((link) => {
    return !allVaultNames.has(targetName(link));
  });

  return { indexFile, missingLinks, staleLinks };
}
