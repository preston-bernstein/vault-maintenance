/**
 * Vault scan: walk files, build path/name/filename indexes, and parse wiki-links
 * from every .md file. Reads files in parallel chunks to limit concurrency.
 */

import { basename, extname } from 'node:path';
import type { ScanResult, VaultFile, WikiLink } from './types.js';
import { pushToMapList } from './collections/map-lists.js';
import {
  walkDir,
  matchesExclude,
  readFileContentSafe,
  toRelativePath,
  isMarkdownFile,
} from './vault-fs/vault-files.js';
import { writeLogLine, isLogging, log } from './logging/logger.js';
import { parseWikiLinks } from './wiki-links/wiki-link-parser.js';

/** Max number of .md files read in parallel when extracting links. */
const READ_CONCURRENCY = 32;

export interface ScanOptions {
  vaultPath: string;
  excludePatterns: string[];
  verbose?: boolean;
}

interface FileIndexes {
  files: VaultFile[];
  mdFiles: VaultFile[];
  fileIndex: Map<string, VaultFile>;
  nameIndex: Map<string, VaultFile[]>;
  filenameIndex: Map<string, VaultFile[]>;
}

function indexFiles(
  allPaths: string[],
  vaultPath: string,
  excludePatterns: string[],
): FileIndexes {
  const indexes: FileIndexes = {
    files: [],
    mdFiles: [],
    fileIndex: new Map(),
    nameIndex: new Map(),
    filenameIndex: new Map(),
  };

  for (const absolutePath of allPaths) {
    const relativePath = toRelativePath(absolutePath, vaultPath);
    if (matchesExclude(relativePath, excludePatterns)) continue;

    const name = basename(relativePath, extname(relativePath));
    const file: VaultFile = { relativePath, name, absolutePath };
    indexes.files.push(file);
    if (isMarkdownFile(relativePath)) indexes.mdFiles.push(file);
    indexes.fileIndex.set(relativePath, file);
    pushToMapList(indexes.nameIndex, name, file);
    pushToMapList(indexes.filenameIndex, basename(relativePath), file);
  }

  return indexes;
}

/** Parse links from markdown files, reading in parallel chunks. */
async function extractLinks(
  mdFiles: VaultFile[],
  verbose: boolean,
): Promise<WikiLink[]> {
  const links: WikiLink[] = [];

  for (let i = 0; i < mdFiles.length; i += READ_CONCURRENCY) {
    const chunk = mdFiles.slice(i, i + READ_CONCURRENCY);
    const contents = await Promise.all(
      chunk.map((f) => readFileContentSafe(f.absolutePath)),
    );
    for (const [j, content] of contents.entries()) {
      if (content === null) {
        await log(
          verbose,
          `Warning: failed to read ${chunk[j].relativePath}, skipping\n`,
        );
        continue;
      }
      links.push(...parseWikiLinks(content, chunk[j].relativePath));
    }
  }

  return links;
}

function reportProgress(message: string, verbose: boolean | undefined): void {
  if (verbose) process.stderr.write(message);
  if (isLogging()) void writeLogLine(message);
}

export async function scanVault(options: ScanOptions): Promise<ScanResult> {
  const { vaultPath, excludePatterns, verbose } = options;

  const allPaths = await walkDir(vaultPath);
  const indexes = indexFiles(allPaths, vaultPath, excludePatterns);
  reportProgress(`Scanned ${indexes.files.length} files\n`, verbose);

  const links = await extractLinks(indexes.mdFiles, verbose ?? false);
  reportProgress(`Found ${links.length} links\n`, verbose);

  return { ...indexes, links };
}

/** All markdown files from a scan result. Uses precomputed mdFiles when present. */
export function getMarkdownFiles(scan: ScanResult): VaultFile[] {
  return (
    scan.mdFiles ?? scan.files.filter((f) => isMarkdownFile(f.relativePath))
  );
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
