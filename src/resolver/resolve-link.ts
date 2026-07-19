/**
 * Single-link resolution logic. Implements Obsidian rules: path match (with /) or
 * bare-name match; ambiguous when multiple files share the same name.
 */

import { extname } from "node:path";
import { lastPathSegment } from "../utils/fs-helpers.js";
import type {
  LinkResolution,
  ScanResult,
  VaultFile,
  WikiLink,
} from "../types.js";

/** Build a resolved result (one target file). */
export function resolved(link: WikiLink, file: VaultFile): LinkResolution {
  return { link, status: "resolved", resolvedTo: file, candidates: [file] };
}

/** Build a broken result (no matching file). */
export function broken(link: WikiLink): LinkResolution {
  return { link, status: "broken", resolvedTo: null, candidates: [] };
}

function lookupByPath(scan: ScanResult, target: string): VaultFile | null {
  const byPath = scan.fileIndex.get(target);
  if (byPath) return byPath;
  if (target.endsWith(".md")) return null;
  return scan.fileIndex.get(target + ".md") ?? null;
}

function resolveByPath(
  link: WikiLink,
  target: string,
  scan: ScanResult,
): LinkResolution {
  const file = lookupByPath(scan, target);
  return file ? resolved(link, file) : broken(link);
}

function resolveByName(
  link: WikiLink,
  target: string,
  scan: ScanResult,
): LinkResolution {
  const ext = extname(target);
  const lookupName = ext ? target.slice(0, -ext.length) : target;

  const candidates = scan.nameIndex.get(lookupName);

  if (!candidates || candidates.length === 0) {
    if (ext) return tryFileWithExtension(link, target, scan);
    return broken(link);
  }

  if (candidates.length === 1) {
    return resolved(link, candidates[0]);
  }

  // Multiple files share this name → ambiguous; prefer shortest path (Obsidian behavior)
  const sorted = [...candidates].sort(
    (a, b) => a.relativePath.length - b.relativePath.length,
  );

  return {
    link,
    status: "ambiguous",
    resolvedTo: sorted[0],
    candidates: sorted,
  };
}

/** Resolve links that include an extension (e.g. ![[image.png]]) via filename index. */
function tryFileWithExtension(
  link: WikiLink,
  target: string,
  scan: ScanResult,
): LinkResolution {
  const filename = lastPathSegment(target);
  const candidates = scan.filenameIndex.get(filename);
  if (!candidates?.length) return broken(link);
  const file = target.includes("/")
    ? candidates.find((f) => f.relativePath.endsWith(target))
    : candidates[0];
  return file ? resolved(link, file) : broken(link);
}

export function resolveLink(link: WikiLink, scan: ScanResult): LinkResolution {
  const target = link.target?.trim() ?? "";
  if (!target) return broken(link);

  if (target.includes("/")) {
    return resolveByPath(link, target, scan);
  }

  return resolveByName(link, target, scan);
}
