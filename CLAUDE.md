# CLAUDE.md

This file provides guidance to **Claude Code** (claude.ai/code) and **Cursor** when working with code in this repository. It is the single source of truth for both—when you update architecture, commands, or conventions, update this file so they stay in sync. The project is developed in **Cursor**; workspace settings (format on save, ESLint, launch configs) are in `.vscode/`.

## What This Is

An Obsidian vault maintenance CLI agent that scans a vault for wiki-link integrity issues: broken links, ambiguous links (multiple files share the same name), and stale/incomplete index files. Optionally uses a chosen AI provider (Claude or OpenAI) to suggest fixes for broken links. Outputs a markdown report written directly into the vault.

## Commands

```bash
npm run build          # tsc → dist/
npm run dev            # Run directly via tsx (no build needed)
npm run test           # vitest run (all tests, single pass)
npm run test:watch     # vitest in watch mode
npm run test:coverage  # vitest with coverage (coverage/)
npx vitest run tests/resolver.test.ts   # Run a single test file
npm run lint           # eslint src/ tests/
npm run format         # prettier (single quotes)
npm run format:check   # prettier check only (CI)
npm run setup:launchd  # Generate macOS LaunchAgent plist for daily 6AM runs
```

## Architecture

- **Entry:** `src/index.ts` — CLI only (Commander options, calls `runPipeline`, exits).
- **Pipeline:** `src/run-pipeline.ts` — Orchestrates runs by phase: load config, then (depending on flags) run read → analyze → report, or a single phase with optional `--input` / `--output`. Not under unit-test coverage (exercised via CLI).

**Phases (sequential):** read (scan) → analyze (resolve, index check, optional AI) → report (generate and write) → enact (future: apply changes; `--apply` reserved, not implemented).

**Phase flags (stackable):** `--scan-only` / `--scan`, `--analyze`, `--report`. No flags = full pipeline. One or more = run only those phases in order; output is the last phase’s result (e.g. `--scan --analyze` runs read then analyze and outputs analysis). `--input <file>` loads prior phase output (scan for analyze, analysis for report). `--output <file>` is contextual: used only when the last phase is scan or analyze (writes that phase’s JSON); when the last phase is report, output goes to the vault or stdout with `--dry-run`, and `--output` is ignored. Serialization in `src/serialization.ts`: ScanResult (Maps ↔ plain objects), ReportData (timestamp ↔ ISO string); helpers `serializeScanResult`, `deserializeScanResult`, `readScanResultFromFile`, and same for ReportData, plus `writeToFile`.

The pipeline runs in order:

1. **Config** (`config.ts`) — Loads `vault-maintenance.config.json`, merges with defaults. Config path overridable via `--config`. Key settings: `vaultPath`, `excludePatterns`, `reportFolder`, `indexCheckDepth`, `ai`.

2. **Scanner** (`scanner.ts`) — **Read phase.** Walks the vault directory, builds three indexes (`fileIndex`, `nameIndex`, `filenameIndex`), parses wiki-links from `.md` files via `utils/wiki-link-parser.ts` (parallel reads in batches).

3. **Resolver** (`resolver.ts` + `resolver/resolve-link.ts`) — **Analyze.** Resolves each wiki-link against the scan indexes (path match vs bare-name match, ambiguity by shortest path). Public API: `resolveLinks`, `getBrokenLinks`, `getAmbiguousLinks`, `getBrokenAndAmbiguousLinks`.

4. **Index Checker** (`index-checker.ts` + `index-checker/check-single.ts`) — **Analyze.** Finds `Index.md` / `Overview.md`, compares links to sibling files within `indexCheckDepth`. Reports missing and stale links. Public API: `checkIndexes`, `indexReportHasIssues`.

5. **AI Suggester** (`ai-suggester.ts` + `ai-providers/`) — **Analyze (optional).** Builds prompt, calls `ai-providers` to get completion text, parses JSON suggestions. **`ai-providers/`**: `index.ts` (getApiKey, complete dispatch), `claude.ts` (Anthropic SDK), `openai.ts` (fetch to OpenAI API). Add a new provider by adding a file and wiring it in `ai-providers/index.ts`.

6. **Reporter** (`reporter.ts` + `reporter/sections.ts`) — **Report phase.** `generateReport` composes sections (header, broken links, AI suggestions, ambiguous links, stale indexes, summary) from `reporter/sections.ts`. `writeReport` writes to `{vaultPath}/{reportFolder}/YYYY-MM-DD.md` with same-day counter.

## Shared utils

- **`utils/fs-helpers.ts`** — Paths, file I/O, glob matching, `isMarkdownFile`, `stripMdExtension`, `formatError`, `toISODateString`, `isValidDate`.
- **`utils/array-helpers.ts`** — `groupBy(items, keyFn)` (group into `Map<K, T[]>`), `pushToMapList(map, key, value)` (append to map-of-arrays). Use these for any “group by key” or “push to list in map” logic.
- **`utils/wiki-link-parser.ts`** — `parseWikiLinks(content, sourceFile)`.

## Key Types

All in `src/types.ts`: `WikiLink`, `VaultFile`, `ScanResult`, `LinkResolution` (status: `resolved | broken | ambiguous`), `IndexReport`, `AISuggestion`, `AIConfig` (includes `provider`: `AIProviderId` = `'claude' | 'openai'`), `Config`.

## CLI Options

`--vault <path>`, `--config <path>`, `--ai / --no-ai`, `--provider claude|openai`, `--dry-run` (report phase: print to stdout, don’t write file), `--json` (machine-readable), `--verbose` (progress to stderr). Phase flags (stackable): `--scan-only` / `--scan`, `--analyze`, `--report`; `--input <file>` (prior phase output); `--output <file>` (contextual: only when last phase is scan or analyze; ignored when last phase is report); `--log-dir <path>` (append run logs to path/YYYY/MM/YYYY-MM-DD.log; overrides config `logDir`); `--apply` (reserved, not implemented). Config may include `logDir`. Exit code 1 if any issues found, 0 if clean, 2 on error.

## Testing

Tests use vitest with a fixture vault at `tests/fixtures/test-vault/`. The fixture has intentional broken links (`[[Nonexistent Page]]`, `[[Gone Page]]`), ambiguous targets (two `Overview.md` files in different folders), and an index with an unlisted page. Tests import source directly from `../src/` (not dist).

## Node Version

Node 22 (see `.nvmrc`). Project uses ESM (`"type": "module"`) with `nodenext` module resolution.

## Repo metadata

- **License:** MIT (see [LICENSE](LICENSE)).
- **Changelog:** [CHANGELOG.md](CHANGELOG.md). Update it when releasing; follow Keep a Changelog + SemVer.
- **Security:** [SECURITY.md](SECURITY.md) (reporting vulnerabilities, safe usage). Do not commit config with secrets or real vault paths.
- **CI:** GitHub Actions in `.github/workflows/ci.yml` (lint, format check, test on push/PR to main or master). Replace `USERNAME` in `package.json` `repository.url` with the actual GitHub username or org after creating the repo.
- **Issue/PR templates:** `.github/ISSUE_TEMPLATE/` (bug report, feature request), `.github/PULL_REQUEST_TEMPLATE.md`.
