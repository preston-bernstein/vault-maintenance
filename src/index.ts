#!/usr/bin/env node
/**
 * CLI entry point. Parses command-line options and runs the maintenance pipeline.
 * Exit codes: 0 = no issues, 1 = issues found, 2 = error.
 */

import { Command } from 'commander';
import { runPipeline } from './run-pipeline.js';
import { formatError } from './utils/fs-helpers.js';
import { writeLogLine, endLogFile, isLogging } from './utils/logger.js';

const program = new Command();

program
  .name('vault-maintenance')
  .description('Obsidian vault maintenance agent')
  .option('--vault <path>', 'Override vault path')
  .option('--config <path>', 'Config file path')
  .option('--ai', 'Enable AI suggestions')
  .option('--no-ai', 'Disable AI suggestions')
  .option(
    '--provider <name>',
    'AI provider: claude or openai (default: claude)',
  )
  .option('--dry-run', 'Print report to stdout, write nothing')
  .option('--json', 'Raw JSON output for scripting')
  .option('--verbose', 'Progress output to stderr')
  .option(
    '--scan-only',
    'Include read phase (scan vault). Can be stacked with --analyze and/or --report',
  )
  .option('--scan', 'Same as --scan-only (include read phase)')
  .option(
    '--analyze',
    'Include analyze phase (resolve links, check indexes, optional AI)',
  )
  .option('--report', 'Include report phase (generate and write report)')
  .option(
    '--input <file>',
    'Path to prior phase output (scan JSON for analyze, analysis JSON for report)',
  )
  .option(
    '--output <file>',
    'Write phase output here (when last phase is scan or analyze) instead of stdout',
  )
  .option(
    '--log-dir <path>',
    'Append run logs to path/YYYY/MM/YYYY-MM-DD.log (overrides config)',
  )
  .option(
    '--apply',
    'Enact phase: apply changes to vault (not yet implemented)',
  )
  .action(async (opts) => {
    try {
      if (opts.apply) {
        process.stderr.write('Error: --apply is not yet implemented\n');
        process.exit(2);
      }
      const pipelineOpts = {
        ...opts,
        scanOnly: Boolean(opts.scanOnly || opts.scan),
        configPath: opts.config,
      };
      const exitCode = await runPipeline(pipelineOpts);
      process.exit(exitCode);
    } catch (err) {
      if (isLogging()) {
        await writeLogLine(`Error: ${formatError(err)}`);
        await endLogFile(2);
      }
      process.stderr.write(`Error: ${formatError(err)}\n`);
      process.exit(2);
    }
  });

program.parse();
