/**
 * AI-powered suggestions for broken wiki-links. Builds a prompt from broken links
 * and vault file list, calls the configured provider (see ai-providers/), and parses
 * JSON suggestions. No-ops when API key is missing or provider fails.
 */

import { stripMdExtension, formatError } from './utils/fs-helpers.js';
import { log, isLogging, writeLogLine } from './utils/logger.js';
import { getApiKey, complete, PROVIDER_ENV } from './ai-providers/index.js';
import type {
  AIConfig,
  AISuggestion,
  LinkResolution,
  ScanResult,
} from './types.js';

/** Minimum confidence (0–1) to include a suggestion in the report. */
const MIN_CONFIDENCE = 0.5;

const PROMPT_TEMPLATE = `You are analyzing an Obsidian vault. The following wiki-links are broken (the target file does not exist).

For each broken link, suggest the most likely intended target from the file list below. Consider:
- Similar filenames (typos, renames)
- Contextual clues from the source file path
- Common naming patterns

Broken links:
{{brokenList}}

All files in vault:
{{fileList}}

Respond with valid JSON only. Format:
[
  {
    "brokenTarget": "the broken link target",
    "suggestedTarget": "path/to/likely/file",
    "confidence": 0.85,
    "reasoning": "short explanation"
  }
]

If no good match exists for a link, omit it from the array. Only suggest matches with confidence >= ${MIN_CONFIDENCE}.`;

function buildPrompt(brokenList: string, fileList: string): string {
  return PROMPT_TEMPLATE.replace('{{brokenList}}', brokenList).replace(
    '{{fileList}}',
    fileList,
  );
}

/**
 * Use an AI provider to suggest likely targets for broken wiki-links.
 * Only runs when AI is enabled and the provider's API key is available.
 * Gracefully returns empty array on any failure.
 */
export async function suggestFixes(
  brokenLinks: LinkResolution[],
  scan: ScanResult,
  config: AIConfig,
  verbose = false,
): Promise<AISuggestion[]> {
  const apiKey = getApiKey(config.provider);
  const envVar = PROVIDER_ENV[config.provider];
  if (!apiKey) {
    const msg = `AI suggestions skipped: ${envVar} not set\n`;
    process.stderr.write(msg);
    if (isLogging()) await writeLogLine(msg);
    return [];
  }

  if (brokenLinks.length === 0) return [];

  try {
    const mdFiles = scan.mdFiles;
    const fileList = mdFiles
      .map((f) => stripMdExtension(f.relativePath))
      .join('\n');
    const brokenList = brokenLinks
      .slice(0, config.maxSuggestions)
      .map(
        (r) =>
          `- "${r.link.target}" in file "${r.link.sourceFile}" (line ${r.link.line})`,
      )
      .join('\n');
    const prompt = buildPrompt(brokenList, fileList);

    const text = await complete(prompt, config, verbose);
    if (text === null) return [];
    return parseSuggestions(text, brokenLinks, verbose);
  } catch (err) {
    const msg = `AI suggestions failed: ${formatError(err)}\n`;
    process.stderr.write(msg);
    if (isLogging()) await writeLogLine(msg);
    return [];
  }
}

interface RawSuggestion {
  brokenTarget: string;
  suggestedTarget: string;
  confidence: number;
  reasoning: string;
}

function isValidRawSuggestion(value: unknown): value is RawSuggestion {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as RawSuggestion).brokenTarget === 'string' &&
    typeof (value as RawSuggestion).suggestedTarget === 'string' &&
    typeof (value as RawSuggestion).confidence === 'number' &&
    Number.isFinite((value as RawSuggestion).confidence) &&
    typeof (value as RawSuggestion).reasoning === 'string'
  );
}

/** Exported for unit tests. */
export function parseSuggestions(
  text: string,
  brokenLinks: LinkResolution[],
  verbose = false,
): AISuggestion[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const raw: unknown[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(raw)) return [];
    const brokenMap = new Map(brokenLinks.map((r) => [r.link.target, r.link]));

    return raw
      .filter(isValidRawSuggestion)
      .filter(
        (s) => s.confidence >= MIN_CONFIDENCE && brokenMap.has(s.brokenTarget),
      )
      .map((s) => ({
        brokenLink: brokenMap.get(s.brokenTarget)!,
        suggestedTarget: s.suggestedTarget,
        confidence: s.confidence,
        reasoning: s.reasoning,
      }));
  } catch (err) {
    void log(
      verbose,
      `AI suggestions failed: could not parse AI response as JSON: ${formatError(err)}\n`,
    );
    return [];
  }
}
