import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

describe('loadConfig', () => {
  it('returns defaults when config file is missing', async () => {
    const configPath = resolve(
      import.meta.dirname,
      'fixtures/nonexistent-config.json',
    );
    const config = await loadConfig(configPath);

    expect(config.vaultPath).toBe('/path/to/your/vault');
    expect(config.excludePatterns).toEqual([
      '.obsidian/**',
      '.claude/**',
      '.DS_Store',
    ]);
    expect(config.reportFolder).toBe('Development/Vault Reports');
    expect(config.indexCheckDepth).toBe(2);
    expect(config.ai.enabled).toBe(false);
    expect(config.ai.provider).toBe('claude');
    expect(config.ai.model).toBe('claude-sonnet-4-20250514');
    expect(config.ai.maxSuggestions).toBe(10);
  });

  it('returns defaults when config file is invalid JSON', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'vault-config-'));
    const configPath = join(tmp, 'config.json');
    await writeFile(configPath, 'not json {', 'utf-8');
    try {
      const config = await loadConfig(configPath);
      expect(config.vaultPath).toBe('/path/to/your/vault');
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it('merges valid config with defaults', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'vault-config-'));
    const configPath = join(tmp, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: '  /my/vault  ',
        reportFolder: 'Reports',
        indexCheckDepth: 3,
        excludePatterns: ['*.tmp'],
        ai: { enabled: true, model: 'claude-3', maxSuggestions: 5 },
      }),
      'utf-8',
    );
    try {
      const config = await loadConfig(configPath);
      expect(config.vaultPath).toBe('/my/vault');
      expect(config.reportFolder).toBe('Reports');
      expect(config.indexCheckDepth).toBe(3);
      expect(config.excludePatterns).toEqual(['*.tmp']);
      expect(config.ai.enabled).toBe(true);
      expect(config.ai.model).toBe('claude-3');
      expect(config.ai.maxSuggestions).toBe(5);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it('uses defaults for missing or invalid nested fields', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'vault-config-'));
    const configPath = join(tmp, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: '/vault',
        ai: { maxSuggestions: 9999 },
      }),
      'utf-8',
    );
    try {
      const config = await loadConfig(configPath);
      expect(config.reportFolder).toBe('Development/Vault Reports');
      expect(config.indexCheckDepth).toBe(2);
      expect(config.ai.enabled).toBe(false);
      expect(config.ai.model).toBe('claude-sonnet-4-20250514');
      expect(config.ai.maxSuggestions).toBe(1000);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it('accepts ai.provider openai and defaults model for it', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'vault-config-'));
    const configPath = join(tmp, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: '/vault',
        ai: { enabled: true, provider: 'openai' },
      }),
      'utf-8',
    );
    try {
      const config = await loadConfig(configPath);
      expect(config.ai.provider).toBe('openai');
      expect(config.ai.model).toBe('gpt-4o-mini');
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it('filters non-string excludePatterns', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'vault-config-'));
    const configPath = join(tmp, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: '/vault',
        excludePatterns: ['.git', 123, null, '*.bak'],
      }),
      'utf-8',
    );
    try {
      const config = await loadConfig(configPath);
      expect(config.excludePatterns).toEqual(['.git', '*.bak']);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
