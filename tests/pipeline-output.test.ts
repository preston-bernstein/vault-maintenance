import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { runPipeline } from '../src/run-pipeline.js';
import { TEST_VAULT } from './test-vault.js';

const FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures');
const ANALYSIS_JSON = join(FIXTURES_DIR, 'analysis.json');
const NO_CONFIG = join(FIXTURES_DIR, 'nonexistent-config.json');

let stdoutCalls: string[];

function captureStdout(): void {
  stdoutCalls = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutCalls.push(String(chunk));
    return true;
  });
}

const vaultOpts = { vault: TEST_VAULT, configPath: NO_CONFIG };

describe('pipeline JSON output without --output', () => {
  beforeEach(captureStdout);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints scan JSON to stdout for the read phase', async () => {
    const code = await runPipeline({ ...vaultOpts, scanOnly: true });
    expect(code).toBe(0);
    expect(stdoutCalls).toHaveLength(1);
    expect(stdoutCalls[0].endsWith('\n')).toBe(true);
    expect(JSON.parse(stdoutCalls[0])).toHaveProperty('files');
  });

  it('prints analysis JSON to stdout for the analyze phase', async () => {
    const code = await runPipeline({
      ...vaultOpts,
      scanOnly: true,
      analyze: true,
    });
    expect(code).toBe(0);
    expect(stdoutCalls).toHaveLength(1);
    expect(JSON.parse(stdoutCalls[0])).toHaveProperty('brokenLinks');
  });

  it('prints analysis JSON for the report phase with --json', async () => {
    const code = await runPipeline({
      ...vaultOpts,
      report: true,
      input: ANALYSIS_JSON,
      json: true,
    });
    expect(code).toBe(0);
    expect(stdoutCalls).toHaveLength(1);
    expect(JSON.parse(stdoutCalls[0])).toHaveProperty('indexReports');
  });
});

describe('pipeline report written to the vault', () => {
  beforeEach(captureStdout);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the report into the vault and prints its path', async () => {
    const vault = await mkdtemp(join(tmpdir(), 'vault-report-'));
    try {
      const code = await runPipeline({
        vault,
        configPath: NO_CONFIG,
        report: true,
        input: ANALYSIS_JSON,
      });
      expect(code).toBe(0);
      expect(stdoutCalls).toHaveLength(1);
      expect(stdoutCalls[0]).toMatch(/^Report: .+\.md\n$/);
      const folders = await readdir(vault);
      expect(folders).toHaveLength(1);
      expect(await readdir(join(vault, folders[0]))).toHaveLength(1);
    } finally {
      await rm(vault, { recursive: true }).catch(() => {});
    }
  });
});
