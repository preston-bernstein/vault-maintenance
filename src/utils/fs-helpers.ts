/**
 * File system helpers: directory walk, glob-style exclude matching, safe read,
 * path helpers (relative, last segment), and date/error formatting.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Recursively list all files in a directory.
 * Returns absolute paths.
 */
export async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      files.push(join(entry.parentPath ?? dir, entry.name));
    }
  }

  return files;
}

const globCache = new Map<string, RegExp>();

function getGlobRegex(pattern: string): RegExp {
  let re = globCache.get(pattern);
  if (re) return re;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  re = new RegExp(`^${regexStr}$`);
  globCache.set(pattern, re);
  return re;
}

/**
 * Check if a relative path matches any of the exclude patterns.
 * Supports glob-like patterns: ** (any depth), * (any segment).
 */
export function matchesExclude(
  relativePath: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    if (matchGlob(relativePath, pattern)) return true;
  }
  return false;
}

function matchGlob(path: string, pattern: string): boolean {
  if (path === pattern) return true;

  if (!pattern.includes('/') && !pattern.includes('*')) {
    return path === pattern || path.endsWith('/' + pattern);
  }

  return getGlobRegex(pattern).test(path);
}

export async function readFileContent(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/** Read file UTF-8; returns null on any error (permission, ENOENT, etc.). */
export async function readFileContentSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

export function toRelativePath(absolutePath: string, vaultRoot: string): string {
  return relative(vaultRoot, absolutePath);
}

/** Last path segment (e.g. "Folder/Page One" → "Page One"). */
export function lastPathSegment(path: string): string {
  if (typeof path !== 'string') return '';
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

export function isMarkdownFile(filePath: string): boolean {
  return filePath.endsWith('.md');
}

const MD_EXT_REGEX = /\.md$/;

export function stripMdExtension(path: string): string {
  return path.replace(MD_EXT_REGEX, '');
}

export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** True if value is a valid Date (not invalid, not NaN). */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** YYYY-MM-DD for a Date; fallback to today if invalid. */
export function toISODateString(date: unknown): string {
  const d = isValidDate(date) ? date : new Date();
  return d.toISOString().slice(0, 10);
}
