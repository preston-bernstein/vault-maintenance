/**
 * Shared types for the vault maintenance pipeline. No logic, only data shapes.
 */

export interface WikiLink {
  raw: string;
  target: string;
  alias: string | null;
  isEmbed: boolean;
  line: number;
  sourceFile: string;
}

export interface VaultFile {
  /** Relative path from vault root, e.g. "Network/Devices/Router.md" */
  relativePath: string;
  /** Bare filename without extension, e.g. "Router" */
  name: string;
  /** Full absolute path */
  absolutePath: string;
}

export interface ScanResult {
  files: VaultFile[];
  /** Markdown files only; set by scanner to avoid repeated filtering */
  mdFiles: VaultFile[];
  links: WikiLink[];
  /** Map from relative path → VaultFile */
  fileIndex: Map<string, VaultFile>;
  /** Map from bare filename (no ext) → VaultFile[] (may have duplicates) */
  nameIndex: Map<string, VaultFile[]>;
  /** Map from full basename (with ext) → VaultFile[] (for embedded asset lookup) */
  filenameIndex: Map<string, VaultFile[]>;
}

export type LinkStatus = 'resolved' | 'broken' | 'ambiguous';

export interface LinkResolution {
  link: WikiLink;
  status: LinkStatus;
  resolvedTo: VaultFile | null;
  candidates: VaultFile[];
}

export interface IndexReport {
  indexFile: VaultFile;
  /** Files in scope folder that are not linked from the index */
  missingLinks: VaultFile[];
  /** Links in the index that point to non-existent files */
  staleLinks: WikiLink[];
}

export interface AISuggestion {
  brokenLink: WikiLink;
  suggestedTarget: string;
  confidence: number;
  reasoning: string;
}

export interface ReportData {
  timestamp: Date;
  totalFiles: number;
  totalLinks: number;
  brokenLinks: LinkResolution[];
  ambiguousLinks: LinkResolution[];
  indexReports: IndexReport[];
  aiSuggestions: AISuggestion[];
}

/** Supported AI providers for link-fix suggestions. */
export type AIProviderId = 'claude' | 'openai';

export interface AIConfig {
  enabled: boolean;
  /** Which AI provider to use (e.g. 'claude', 'openai'). */
  provider: AIProviderId;
  model: string;
  maxSuggestions: number;
}

export interface Config {
  vaultPath: string;
  excludePatterns: string[];
  reportFolder: string;
  indexCheckDepth: number;
  ai: AIConfig;
}
