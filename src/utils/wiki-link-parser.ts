/**
 * Parses Obsidian-style wiki-links from markdown ([[target]], [[target|alias]], ![[embed]]).
 * Skips links inside fenced code blocks. Returns [] if content is not a string.
 */

import type { WikiLink } from '../types.js';

const WIKI_LINK_RE = /(!?)\[\[([^\]]+)\]\]/g;
const FENCE_RE = /^```/;

/**
 * Extract all wiki-links from markdown content.
 * Skips links inside fenced code blocks.
 * Returns [] if content is not a string.
 */
export function parseWikiLinks(
  content: string,
  sourceFile: string
): WikiLink[] {
  if (typeof content !== 'string') return [];
  const links: WikiLink[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_RE.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    let match: RegExpExecArray | null;
    // Reset lastIndex for each line since we reuse the regex
    WIKI_LINK_RE.lastIndex = 0;

    while ((match = WIKI_LINK_RE.exec(line)) !== null) {
      const isEmbed = match[1] === '!';
      const inner = match[2];
      const pipeIndex = inner.indexOf('|');

      let target: string;
      let alias: string | null;

      if (pipeIndex !== -1) {
        target = inner.slice(0, pipeIndex).trim();
        alias = inner.slice(pipeIndex + 1).trim();
      } else {
        target = inner.trim();
        alias = null;
      }

      links.push({
        raw: match[0],
        target,
        alias,
        isEmbed,
        line: i + 1,
        sourceFile,
      });
    }
  }

  return links;
}
