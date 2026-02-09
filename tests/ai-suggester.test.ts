import { describe, it, expect, vi } from 'vitest';
import { suggestFixes, parseSuggestions } from '../src/ai-suggester.js';
import type { LinkResolution } from '../src/types.js';
import { emptyScanResult, defaultAIConfig } from './helpers.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor(_opts: { apiKey: string }) {}
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '[{"brokenTarget":"Missing","suggestedTarget":"Other.md","confidence":0.9,"reasoning":"typo"}]',
          },
        ],
      }),
    };
  },
}));

const makeBrokenLink = (target: string, sourceFile = 'test.md'): LinkResolution => ({
  link: {
    raw: `[[${target}]]`,
    target,
    alias: null,
    isEmbed: false,
    line: 1,
    sourceFile,
  },
  status: 'broken',
  resolvedTo: null,
  candidates: [],
});

describe('suggestFixes', () => {
  it('returns empty array when no API key is set', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await suggestFixes(
      [makeBrokenLink('Missing')],
      emptyScanResult(),
      defaultAIConfig()
    );

    expect(result).toEqual([]);
    if (original) process.env.ANTHROPIC_API_KEY = original;
  });

  it('returns empty array when no broken links', async () => {
    const result = await suggestFixes(
      [],
      emptyScanResult(),
      defaultAIConfig()
    );
    expect(result).toEqual([]);
  });

  it('returns suggestions when API key is set and SDK is available', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    try {
      const brokenLinks = [makeBrokenLink('Missing')];
      const scan = emptyScanResult();
      scan.files.push({
        relativePath: 'Other.md',
        name: 'Other',
        absolutePath: '/vault/Other.md',
      });
      scan.fileIndex.set('Other.md', scan.files[0]!);

      const result = await suggestFixes(brokenLinks, scan, defaultAIConfig());

      expect(result).toHaveLength(1);
      expect(result[0]!.brokenLink.target).toBe('Missing');
      expect(result[0]!.suggestedTarget).toBe('Other.md');
      expect(result[0]!.confidence).toBe(0.9);
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('returns empty when OpenAI is chosen but OPENAI_API_KEY is not set', async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await suggestFixes(
      [makeBrokenLink('X')],
      emptyScanResult(),
      { ...defaultAIConfig(), provider: 'openai', model: 'gpt-4o-mini' }
    );

    expect(result).toEqual([]);
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  });

  it('returns suggestions when using OpenAI provider and API key', async () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content:
                  '[{"brokenTarget":"X","suggestedTarget":"Y.md","confidence":0.8,"reasoning":"match"}]',
              },
            },
          ],
        }),
    });
    globalThis.fetch = mockFetch;

    try {
      const brokenLinks = [makeBrokenLink('X')];
      const scan = emptyScanResult();
      scan.files.push({
        relativePath: 'Y.md',
        name: 'Y',
        absolutePath: '/vault/Y.md',
      });

      const result = await suggestFixes(brokenLinks, scan, {
        ...defaultAIConfig(),
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.brokenLink.target).toBe('X');
      expect(result[0]!.suggestedTarget).toBe('Y.md');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    } finally {
      if (originalEnv !== undefined) process.env.OPENAI_API_KEY = originalEnv;
      else delete process.env.OPENAI_API_KEY;
      globalThis.fetch = originalFetch;
    }
  });
});

describe('parseSuggestions', () => {
  const brokenLinks = [
    makeBrokenLink('Broken A'),
    makeBrokenLink('Broken B'),
  ];

  it('parses valid JSON array and maps to broken links', () => {
    const text = '[{"brokenTarget":"Broken A","suggestedTarget":"path/Fix.md","confidence":0.85,"reasoning":"match"}]';
    const result = parseSuggestions(text, brokenLinks);
    expect(result).toHaveLength(1);
    expect(result[0].brokenLink.target).toBe('Broken A');
    expect(result[0].suggestedTarget).toBe('path/Fix.md');
    expect(result[0].confidence).toBe(0.85);
    expect(result[0].reasoning).toBe('match');
  });

  it('extracts JSON from markdown code block', () => {
    const text = '```json\n[{"brokenTarget":"Broken A","suggestedTarget":"x.md","confidence":0.6,"reasoning":"r"}]\n```';
    const result = parseSuggestions(text, brokenLinks);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedTarget).toBe('x.md');
  });

  it('filters out suggestions with confidence < 0.5', () => {
    const text = '[{"brokenTarget":"Broken A","suggestedTarget":"x.md","confidence":0.3,"reasoning":"r"}]';
    const result = parseSuggestions(text, brokenLinks);
    expect(result).toHaveLength(0);
  });

  it('filters out suggestions for unknown broken target', () => {
    const text = '[{"brokenTarget":"NotInList","suggestedTarget":"x.md","confidence":0.9,"reasoning":"r"}]';
    const result = parseSuggestions(text, brokenLinks);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no JSON array in text', () => {
    expect(parseSuggestions('no bracket here', brokenLinks)).toEqual([]);
    expect(parseSuggestions('', brokenLinks)).toEqual([]);
  });

  it('returns empty array when JSON is invalid', () => {
    const result = parseSuggestions('[invalid json', brokenLinks);
    expect(result).toEqual([]);
  });

  it('ignores entries missing required fields', () => {
    const text = '[{"brokenTarget":"Broken A","suggestedTarget":"x.md"}]';
    const result = parseSuggestions(text, brokenLinks);
    expect(result).toHaveLength(0);
  });
});
