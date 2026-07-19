import { resolve } from "node:path";
import { scanVault } from "../src/scanner.js";
import type { ScanResult } from "../src/types.js";

/** Empty scan result for unit tests that only need a valid ScanResult shape. */
export function emptyScanResult(): ScanResult {
  return {
    files: [],
    mdFiles: [],
    links: [],
    fileIndex: new Map(),
    nameIndex: new Map(),
    filenameIndex: new Map(),
  };
}

/** Default AI config used in tests. */
export const defaultAIConfig = () => ({
  enabled: true,
  provider: "claude" as const,
  model: "claude-sonnet-4-20250514",
  maxSuggestions: 10,
});

/** Fixture vault path used by scanner, resolver, and index-checker tests. */
export const TEST_VAULT = resolve(import.meta.dirname, "fixtures/test-vault");

/** Default options for scanning the test vault (excludes .obsidian). */
export const defaultScanOptions = () => ({
  vaultPath: TEST_VAULT,
  excludePatterns: [".obsidian/**"] as string[],
});

/** Scan the test vault with default options. */
export async function scanTestVault(): Promise<ScanResult> {
  return scanVault(defaultScanOptions());
}
