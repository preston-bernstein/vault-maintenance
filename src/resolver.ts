/**
 * Public API for link resolution. Resolves each wiki-link against the vault indexes
 * and provides helpers to filter by status (broken, ambiguous).
 */

import { resolveLink } from './resolver/resolve-link.js';
import type { LinkResolution, ScanResult } from './types.js';

/**
 * Resolve all wiki-links against the vault file index.
 * Implements Obsidian's resolution rules:
 * - Link contains "/" → exact path match (with or without .md)
 * - Link has no "/" → bare filename match (shortest unique path)
 */
export function resolveLinks(scan: ScanResult): LinkResolution[] {
  const { links } = scan;
  const resolutions = new Array<LinkResolution>(links.length);
  for (let i = 0; i < links.length; i++) {
    resolutions[i] = resolveLink(links[i]!, scan);
  }
  return resolutions;
}

function getLinksByStatus(
  resolutions: LinkResolution[],
  status: LinkResolution['status'],
): LinkResolution[] {
  return resolutions.filter((r) => r.status === status);
}

/** Filter resolutions to only broken links */
export function getBrokenLinks(
  resolutions: LinkResolution[],
): LinkResolution[] {
  return getLinksByStatus(resolutions, 'broken');
}

/** Filter resolutions to only ambiguous links */
export function getAmbiguousLinks(
  resolutions: LinkResolution[],
): LinkResolution[] {
  return getLinksByStatus(resolutions, 'ambiguous');
}

/** Single pass: split resolutions into broken and ambiguous. */
export function getBrokenAndAmbiguousLinks(resolutions: LinkResolution[]): {
  brokenLinks: LinkResolution[];
  ambiguousLinks: LinkResolution[];
} {
  const brokenLinks: LinkResolution[] = [];
  const ambiguousLinks: LinkResolution[] = [];
  for (const r of resolutions) {
    if (r.status === 'broken') brokenLinks.push(r);
    else if (r.status === 'ambiguous') ambiguousLinks.push(r);
  }
  return { brokenLinks, ambiguousLinks };
}
