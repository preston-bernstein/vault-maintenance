import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runPipeline } from '../src/run-pipeline.js';
import {
  deserializeScanResult,
  deserializeReportData,
} from '../src/serialization.js';
import { TEST_VAULT } from './helpers.js';

const FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures');
const SCAN_JSON = join(FIXTURES_DIR, 'scan.json');
const ANALYSIS_JSON = join(FIXTURES_DIR, 'analysis.json');

/** Config path that does not exist so loadConfig returns defaults. */
const NO_CONFIG = join(FIXTURES_DIR, 'nonexistent-config.json');

function defaultOpts(overrides: Record<string, unknown> = {}) {
  return {
    vault: TEST_VAULT,
    configPath: NO_CONFIG,
    ...overrides,
  };
}

describe('pipeline phase flags', () => {
  describe('--scan-only / --scan', () => {
    it('writes valid scan JSON to --output and deserializes to ScanResult shape (scanOnly)', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-scan-'));
      const outputPath = join(tmp, 'scan-out.json');
      try {
        const code = await runPipeline(
          defaultOpts({ scanOnly: true, output: outputPath })
        );
        expect(code).toBe(0);
        const raw = await readFile(outputPath, 'utf-8');
        const scan = deserializeScanResult(raw);
        expect(scan).toBeDefined();
        expect(scan.files).toBeDefined();
        expect(Array.isArray(scan.files)).toBe(true);
        expect(scan.mdFiles).toBeDefined();
        expect(scan.links).toBeDefined();
        expect(scan.fileIndex).toBeInstanceOf(Map);
        expect(scan.nameIndex).toBeInstanceOf(Map);
        expect(scan.filenameIndex).toBeInstanceOf(Map);
      } finally {
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });

    it('--scan alias: same behavior as --scan-only (scan phase only, output to file)', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-scan-alias-'));
      const outputPath = join(tmp, 'scan-out.json');
      try {
        const code = await runPipeline(
          defaultOpts({ scan: true, output: outputPath })
        );
        expect(code).toBe(0);
        const raw = await readFile(outputPath, 'utf-8');
        const scan = deserializeScanResult(raw);
        expect(scan).toBeDefined();
        expect(scan.fileIndex).toBeInstanceOf(Map);
        expect(scan.nameIndex).toBeInstanceOf(Map);
      } finally {
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });
  });

  describe('--analyze --input', () => {
    it('reads scan from file and writes valid analysis JSON to --output', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-analyze-'));
      const outputPath = join(tmp, 'analysis-out.json');
      try {
        const code = await runPipeline(
          defaultOpts({
            analyze: true,
            input: SCAN_JSON,
            output: outputPath,
          })
        );
        expect(code).toBe(0);
        const raw = await readFile(outputPath, 'utf-8');
        const data = deserializeReportData(raw);
        expect(data).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        expect(typeof data.totalFiles).toBe('number');
        expect(typeof data.totalLinks).toBe('number');
        expect(Array.isArray(data.brokenLinks)).toBe(true);
        expect(Array.isArray(data.ambiguousLinks)).toBe(true);
        expect(Array.isArray(data.indexReports)).toBe(true);
        expect(Array.isArray(data.aiSuggestions)).toBe(true);
      } finally {
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });
  });

  describe('--report --input', () => {
    let stdoutCalls: string[];

    beforeEach(() => {
      stdoutCalls = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        stdoutCalls.push(String(chunk));
        return true;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('reads analysis from file and outputs report (dry-run)', async () => {
      const code = await runPipeline(
        defaultOpts({
          report: true,
          input: ANALYSIS_JSON,
          dryRun: true,
        })
      );
      expect(code).toBe(0);
      const out = stdoutCalls.join('');
      expect(out).toContain('Vault maintenance report');
      expect(out).toContain('Summary');
    });
  });

  describe('stacked flags (--scan-only --analyze)', () => {
    it('runs read then analyze in one process and outputs analysis (no report)', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-stack-'));
      const outputPath = join(tmp, 'analysis-out.json');
      try {
        const code = await runPipeline(
          defaultOpts({
            scanOnly: true,
            analyze: true,
            output: outputPath,
          })
        );
        expect(code).toBe(0);
        const raw = await readFile(outputPath, 'utf-8');
        const data = deserializeReportData(raw);
        expect(data).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        expect(Array.isArray(data.brokenLinks)).toBe(true);
        expect(Array.isArray(data.indexReports)).toBe(true);
      } finally {
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });
  });

  describe('--output is contextual', () => {
    it('when last phase is report, --output is ignored and report goes to stdout with dry-run', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-output-ctx-'));
      const outputPath = join(tmp, 'ignored-output.json');
      const stdoutCalls: string[] = [];
      const unspy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        stdoutCalls.push(String(chunk));
        return true;
      });
      try {
        const code = await runPipeline(
          defaultOpts({
            report: true,
            input: ANALYSIS_JSON,
            dryRun: true,
            output: outputPath,
          })
        );
        expect(code).toBe(0);
        const out = stdoutCalls.join('');
        expect(out).toContain('Vault maintenance report');
        expect(out).toContain('Summary');
        const { access } = await import('node:fs/promises');
        await expect(access(outputPath)).rejects.toThrow();
      } finally {
        unspy.mockRestore();
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });
  });

  describe('full pipeline (no phase flags)', () => {
    it('runs read → analyze → report and outputs report to stdout with dry-run', async () => {
      const stdoutCalls: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        stdoutCalls.push(String(chunk));
        return true;
      });
      try {
        const code = await runPipeline(
          defaultOpts({ dryRun: true })
        );
        const out = stdoutCalls.join('');
        expect(out).toContain('Vault maintenance report');
        expect(out).toContain('Summary');
        expect(code).toBe(1);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('log file (--log-dir)', () => {
    it('writes run log to logDir/YYYY/MM/YYYY-MM-DD.log with header and finish line', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'vault-logs-'));
      try {
        const code = await runPipeline(
          defaultOpts({ scanOnly: true, logDir: tmp, verbose: true })
        );
        expect(code).toBe(0);
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = now.toISOString().slice(0, 10);
        const logPath = join(tmp, String(y), m, `${d}.log`);
        const content = await readFile(logPath, 'utf-8');
        expect(content).toContain('Run start');
        expect(content).toContain('vault:');
        expect(content).toContain('Run finished');
        expect(content).toContain('exitCode=0');
        expect(content).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      } finally {
        await rm(tmp, { recursive: true }).catch(() => {});
      }
    });
  });
});
