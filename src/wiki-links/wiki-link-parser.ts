/**
 * Parses Obsidian-style wiki-links from markdown ([[target]], [[target|alias]], ![[embed]]).
 * Skips links inside fenced code blocks. Returns [] if content is not a string.
 */

import type { WikiLink } from '../types.js';

const WIKI_LINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
const FENCE_RE = /^```/;

/** Split "target|alias" inner text; alias is null when there is no pipe. */
function splitTargetAndAlias(inner: string): {
  target: string;
  alias: string | null;
} {
  const pipeIndex = inner.indexOf('|');
  if (pipeIndex === -1) return { target: inner.trim(), alias: null };
  return {
    target: inner.slice(0, pipeIndex).trim(),
    alias: inner.slice(pipeIndex + 1).trim(),
  };
}

/** Wiki-links on one line. `lineNumber` is 1-based. */
function parseLine(
  line: string,
  lineNumber: number,
  sourceFile: string,
): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex for each line since we reuse the regex
  WIKI_LINK_RE.lastIndex = 0;

  while ((match = WIKI_LINK_RE.exec(line)) !== null) {
    links.push({
      raw: match[0],
      ...splitTargetAndAlias(match[2]),
      isEmbed: match[1] === '!',
      line: lineNumber,
      sourceFile,
    });
  }

  return links;
}

/**
 * Extract all wiki-links from markdown content.
 * Skips links inside fenced code blocks.
 * Returns [] if content is not a string.
 */
export function parseWikiLinks(
  content: string,
  sourceFile: string,
): WikiLink[] {
  if (typeof content !== 'string') return [];
  const links: WikiLink[] = [];
  let inCodeBlock = false;

  for (const [i, line] of content.split('\n').entries()) {
    if (FENCE_RE.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    links.push(...parseLine(line, i + 1, sourceFile));
  }

  return links;
}
