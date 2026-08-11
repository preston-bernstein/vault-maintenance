# vault-maintenance

[![CI](https://github.com/preston-bernstein/vault-maintenance/actions/workflows/ci.yml/badge.svg)](https://github.com/preston-bernstein/vault-maintenance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI that scans your [Obsidian](https://obsidian.md) vault for wiki-link issues and writes a markdown report. Keeps link integrity in check and surfaces broken links, ambiguous targets, and stale index files—optionally with AI-powered fix suggestions.

Use it locally or on a schedule (e.g. macOS LaunchAgent) to keep vault links and index pages in good shape.

## Features

- **Broken links** — Finds `[[wiki-links]]` that don’t resolve to any file
- **Ambiguous links** — Flags links whose target name matches multiple files (e.g. several `Overview.md` in different folders)
- **Index / overview staleness** — Detects `Index.md` and `Overview.md` with missing or dead links relative to their folder
- **Optional AI suggestions** — Uses a chosen AI provider (Claude or OpenAI) to suggest likely targets for broken links
- **Report in the vault** — Writes a dated markdown report (e.g. `YYYY-MM-DD.md`) into a folder you choose, or stdout with `--dry-run`

## Requirements

- **Node 22+** ([.nvmrc](.nvmrc) included; run `nvm use` if you use nvm)
- For AI suggestions: set the provider’s API key (`ANTHROPIC_API_KEY` for Claude, `OPENAI_API_KEY` for OpenAI). Claude also requires the optional dependency `@anthropic-ai/sdk`.

## Install

```bash
git clone https://github.com/preston-bernstein/vault-maintenance.git
cd vault-maintenance
npm install
```

## Quick start

Run against a vault (no config file required):

```bash
npm run dev -- --vault /path/to/your/vault
```

Or use a config file. Create `vault-maintenance.config.json` in the project root (see [Config](#config)), then:

```bash
npm run dev
```

### Example output

The tool prints where the report was written (or the report itself with `--dry-run`). Report contents look like:

```markdown
# Vault maintenance report
## Broken links (2)
| Source | Broken link | Line |
| [[Notes/Old]] | `[[Moved Page]]` | 12 |
...
## Ambiguous links (1)
...
## Stale indexes (1)
...
## Summary
| Metric | Count |
| Total files | 42 | ...
```

Exit code: `0` if no issues, `1` if any were found, `2` on error.

## Config

Create `vault-maintenance.config.json` (or pass `--config <path>`):

```json
{
  "vaultPath": "/path/to/vault",
  "excludePatterns": [".obsidian/**", ".claude/**", ".DS_Store"],
  "reportFolder": "Development/Vault Reports",
  "indexCheckDepth": 2,
  "logDir": "/path/to/logs",
  "ai": {
    "enabled": false,
    "provider": "claude",
    "model": "claude-sonnet-4-20250514",
    "maxSuggestions": 10
  }
}
```

| Field | Description |
|-------|-------------|
| `vaultPath` | Vault root (required unless you pass `--vault`) |
| `excludePatterns` | Glob-like patterns; matching paths are excluded from the scan |
| `reportFolder` | Path inside the vault where reports are written (e.g. `YYYY-MM-DD.md`) |
| `indexCheckDepth` | Folder depth used to decide index/overview scope |
| `logDir` | Optional. When set, each run appends to `logDir/YYYY/MM/YYYY-MM-DD.log` with timestamps and run start/finish headers. Useful for scheduled runs (e.g. Docker, cron). |
| `ai` | Optional AI suggestions. `provider`: `"claude"` or `"openai"`. Set `ANTHROPIC_API_KEY` (Claude) or `OPENAI_API_KEY` (OpenAI). `model` defaults to a sensible model per provider. |

Do not commit config files that contain secrets or your real vault path; use a local config (e.g. `vault-maintenance.config.local.json`) or environment variables for API keys.

## CLI options

| Option | Description |
|--------|-------------|
| `--vault <path>` | Override vault path |
| `--config <path>` | Path to config file |
| `--ai` / `--no-ai` | Enable or disable AI suggestions |
| `--provider <name>` | AI provider: `claude` or `openai` (default: claude) |
| `--dry-run` | **Report phase:** print report to stdout and do not write a file to the vault. (A future enact phase may support its own dry-run.) |
| `--json` | Emit machine-readable JSON instead of a report |
| `--verbose` | Print progress to stderr |
| `--scan-only` | Include the read phase (scan vault). Can be stacked with `--analyze` and/or `--report` |
| `--scan` | Same as `--scan-only` (short form) |
| `--analyze` | Include the analyze phase (resolve links, check indexes, optional AI) |
| `--report` | Include the report phase (generate and write report) |
| `--input <file>` | Path to prior phase output (scan JSON for analyze, analysis JSON for report) |
| `--output <file>` | **Contextual:** when the **last** phase is scan or analyze, write that phase’s JSON here (otherwise stdout). When the last phase is report, this is ignored; report is written to the vault or printed with `--dry-run`. |
| `--log-dir <path>` | Append run logs to `path/YYYY/MM/YYYY-MM-DD.log` (timestamps and run headers; overrides config `logDir`) |
| `--apply` | Enact phase: apply changes to vault (reserved; not yet implemented) |

With **no** phase flags, the full pipeline runs (read → analyze → report). With **one or more** of `--scan-only`/`--scan`, `--analyze`, `--report`, only those phases run in order; **output is the last phase’s result**. Stacking e.g. `--scan --analyze` runs read then analyze in one process and outputs analysis (no report file).

### Phased runs

You can run the pipeline in separate steps and pass data between runs via files:

```bash
# 1. Scan only — write scan result to a file
vault-maintenance --scan-only --output scan.json

# 2. Analyze using that scan (no rescan)
vault-maintenance --analyze --input scan.json --output analysis.json

# 3. Generate report from analysis (no rescan)
vault-maintenance --report --input analysis.json
```

Or run two phases in one go (e.g. scan then analyze, output analysis):

```bash
vault-maintenance --scan-only --analyze --output analysis.json
```

Without `--input`, `--analyze` runs the scan in memory first; without `--input`, `--report` runs scan and analyze in memory. Omit `--output` to write phase output to stdout.

**Stacking:** Phase flags are additive. Order is always read → analyze → report; the **last** flag in your set determines what is produced (scan JSON, analysis JSON, or the markdown report). This matches a “mode flags = run these steps, output = last step” design (see `docs/FILEBOT-CLI-ANALYSIS.md`).

## Project structure

| Path | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry (options, exit codes) |
| `src/run-pipeline.ts` | Pipeline phases: read → analyze → report (optional phase flags, --input/--output) |
| `src/serialization.ts` | Serialize/deserialize ScanResult and ReportData for phased runs |
| `src/scanner.ts` | Walk vault, build file/name indexes, parse wiki-links from `.md` |
| `src/resolver/` | Resolve each link (path or name match; ambiguous when multiple same name) |
| `src/index-checker/` | Find Index/Overview pages, report missing or stale links |
| `src/ai-suggester.ts` | Build prompt, call provider, parse suggestions |
| `src/ai-providers/` | Claude and OpenAI completion (add more by wiring a new provider) |
| `src/reporter/` | Build markdown report sections and write to vault |
| `src/config.ts` | Load and merge `vault-maintenance.config.json` |
| `tests/` | Vitest tests; fixture vault in `tests/fixtures/test-vault/` |

For more detail (types, conventions), see [CLAUDE.md](CLAUDE.md).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run CLI with tsx (no build). Append `-- --vault <path>` etc. |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage (`coverage/` is gitignored) |
| `npm run lint` | ESLint on `src/` and `tests/` |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier check only (for CI) |
| `npm run setup:launchd` | Generate a macOS LaunchAgent plist for daily 6AM runs |

## Contributing

1. Install and test: `npm install && npm run test`
2. Lint and format: `npm run lint && npm run format`
3. Open an issue or PR. CI runs lint, format check, build, and tests on push and PRs.

The repo is set up for [Cursor](https://cursor.com) and VS Code (format-on-save, Vitest). Tests use a fixture vault under `tests/fixtures/test-vault/`.

## Development note

This project was developed with the help of AI-assisted coding tools (e.g. Cursor, Claude). The codebase is structured for clarity and maintainability; see [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
