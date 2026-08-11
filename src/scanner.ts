/**
 * Vault scan: walk files, build path/name/filename indexes, and parse wiki-links
 * from every .md file. Reads files in parallel chunks to limit concurrency.
 */

import { basename, extname } from 'node:path';
import type { ScanResult, VaultFile, WikiLink } from './types.js';
import { pushToMapList } from './utils/array-helpers.js';
import {
  walkDir,
  matchesExclude,
  readFileContentSafe,
  toRelativePath,
  isMarkdownFile,
} from './utils/fs-helpers.js';
import { writeLogLine, isLogging } from './utils/logger.js';
import { parseWikiLinks } from './utils/wiki-link-parser.js';

/** Max number of .md files read in parallel when extracting links. */
const READ_CONCURRENCY = 32;

export interface ScanOptions {
  vaultPath: string;
  excludePatterns: string[];
  verbose?: boolean;
}

export async function scanVault(options: ScanOptions): Promise<ScanResult> {
  const { vaultPath, excludePatterns, verbose } = options;

  const allPaths = await walkDir(vaultPath);

  const files: VaultFile[] = [];
  const mdFiles: VaultFile[] = [];
  const fileIndex = new Map<string, VaultFile>();
  const nameIndex = new Map<string, VaultFile[]>();
  const filenameIndex = new Map<string, VaultFile[]>();

  for (const absolutePath of allPaths) {
    const relativePath = toRelativePath(absolutePath, vaultPath);

    if (matchesExclude(relativePath, excludePatterns)) continue;

    const ext = extname(relativePath);
    const name = basename(relativePath, ext);
    const filename = basename(relativePath);

    const file: VaultFile = { relativePath, name, absolutePath };
    files.push(file);
    if (isMarkdownFile(relativePath)) mdFiles.push(file);
    fileIndex.set(relativePath, file);
    pushToMapList(nameIndex, name, file);
    pushToMapList(filenameIndex, filename, file);
  }

  if (verbose) process.stderr.write(`Scanned ${files.length} files\n`);
  if (isLogging()) void writeLogLine(`Scanned ${files.length} files\n`);

  // Parse links from markdown files (parallel reads with concurrency limit)
  const links: WikiLink[] = [];

  for (let i = 0; i < mdFiles.length; i += READ_CONCURRENCY) {
    const chunk = mdFiles.slice(i, i + READ_CONCURRENCY);
    const contents = await Promise.all(
      chunk.map((f) => readFileContentSafe(f.absolutePath))
    );
    for (let j = 0; j < chunk.length; j++) {
      const content = contents[j];
      if (content !== null) {
        const fileLinks = parseWikiLinks(content, chunk[j].relativePath);
        for (let k = 0; k < fileLinks.length; k++) links.push(fileLinks[k]);
      }
    }
  }

  if (verbose) process.stderr.write(`Found ${links.length} links\n`);
  if (isLogging()) void writeLogLine(`Found ${links.length} links\n`);

  return { files, links, mdFiles, fileIndex, nameIndex, filenameIndex };
}

/** All markdown files from a scan result. Uses precomputed mdFiles when present. */
export function getMarkdownFiles(scan: ScanResult): VaultFile[] {
  return scan.mdFiles ?? scan.files.filter((f) => isMarkdownFile(f.relativePath));
}

/** Count of markdown files. O(1) when scan has mdFiles. */
export function getMarkdownFileCount(scan: ScanResult): number {
  if (scan.mdFiles) return scan.mdFiles.length;
  let count = 0;
  for (const f of scan.files) {
    if (isMarkdownFile(f.relativePath)) count++;
  }
  return count;
}
