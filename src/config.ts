/**
 * Load and merge config from JSON. Uses safe coercion and defaults for missing/invalid values.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Config, AIProviderId } from './types.js';
import { formatError } from './utils/fs-helpers.js';

const VALID_PROVIDERS = new Set<string>(['claude', 'openai']);

const DEFAULTS: Config = {
  vaultPath: '/path/to/your/vault',
  excludePatterns: ['.obsidian/**', '.claude/**', '.DS_Store'],
  reportFolder: 'Development/Vault Reports',
  indexCheckDepth: 2,
  ai: {
    enabled: false,
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    maxSuggestions: 10,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Coerce to a non-negative integer; cap at max if provided. */
function safeNonNegativeInt(
  value: unknown,
  defaultVal: number,
  max?: number,
): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? value : defaultVal;
  const clamped = Math.max(0, Math.floor(n));
  return max !== undefined ? Math.min(clamped, max) : clamped;
}

function safeString(value: unknown, defaultVal: string): string {
  return typeof value === 'string' ? value : defaultVal;
}

function safeStringArray(value: unknown, defaultVal: string[]): string[] {
  if (!Array.isArray(value)) return defaultVal;
  return value.filter((p): p is string => typeof p === 'string');
}

export async function loadConfig(configPath?: string): Promise<Config> {
  const path =
    configPath ??
    resolve(import.meta.dirname, '..', 'vault-maintenance.config.json');

  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return mergeConfig(parsed);
  } catch (err) {
    const isMissingFile =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (!isMissingFile) {
      process.stderr.write(
        `Warning: failed to load config (${formatError(err)}), using defaults\n`,
      );
    }
    return { ...DEFAULTS };
  }
}

function mergeConfig(parsed: unknown): Config {
  if (!isRecord(parsed)) return { ...DEFAULTS };

  const logDir = safeString(parsed.logDir, '');
  return {
    vaultPath:
      safeString(parsed.vaultPath, DEFAULTS.vaultPath).trim() ||
      DEFAULTS.vaultPath,
    excludePatterns: safeStringArray(
      parsed.excludePatterns,
      DEFAULTS.excludePatterns,
    ),
    reportFolder: safeString(parsed.reportFolder, DEFAULTS.reportFolder),
    indexCheckDepth: safeNonNegativeInt(
      parsed.indexCheckDepth,
      DEFAULTS.indexCheckDepth,
    ),
    logDir: logDir.trim() || undefined,
    ai: mergeAIConfig(parsed.ai),
  };
}

function mergeAIConfig(parsed?: unknown) {
  if (!isRecord(parsed)) return { ...DEFAULTS.ai };
  const providerRaw = safeString(parsed.provider, DEFAULTS.ai.provider);
  const provider: AIProviderId = VALID_PROVIDERS.has(providerRaw)
    ? (providerRaw as AIProviderId)
    : DEFAULTS.ai.provider;
  const defaultModel =
    provider === 'openai' ? 'gpt-4o-mini' : DEFAULTS.ai.model;
  return {
    enabled:
      typeof parsed.enabled === 'boolean'
        ? parsed.enabled
        : DEFAULTS.ai.enabled,
    provider,
    model: safeString(parsed.model, defaultModel),
    maxSuggestions: safeNonNegativeInt(
      parsed.maxSuggestions,
      DEFAULTS.ai.maxSuggestions,
      1000,
    ),
  };
}
