# vault-maintenance

A CLI that scans an [Obsidian](https://obsidian.md) vault for wiki-link problems and writes a markdown report. It keeps link integrity in check. It can also ask an AI provider to suggest fixes.

It finds three kinds of problem:

- **Broken links:** a `[[wiki-link]]` that matches no file.
- **Ambiguous links:** a link whose name matches several files, such as many `Overview.md` files.
- **Stale indexes:** an `Index.md` or `Overview.md` with missing or dead links to its folder.

## Install and run

1. Install Node 22 or later. `.nvmrc` pins the version, so `nvm use` works.
2. Run `git clone https://github.com/preston-bernstein/vault-maintenance.git`.
3. Run `cd vault-maintenance && npm install`.
4. Run `npm run dev -- --vault /path/to/your/vault`.

The tool writes a dated report (`YYYY-MM-DD.md`) into `reportFolder` inside the vault. Add `--dry-run` to print the report instead.

The exit code is `0` if the scan finds no issues, `1` if it finds any, and `2` on error.

## Configure with `vault-maintenance.config.json`

Without `--vault`, the tool reads `vault-maintenance.config.json` from the project root. Use `--config <path>` for another file. The repo ships a sample.

| Field | Meaning | Default |
|---|---|---|
| `vaultPath` | Vault root. Required unless you pass `--vault`. | none |
| `excludePatterns` | Glob-like patterns to skip. | none in code; the sample skips `.obsidian/**`, `.claude/**`, `.DS_Store` |
| `reportFolder` | Folder in the vault for reports. | `Development/Vault Reports` |
| `indexCheckDepth` | Folder depth that sets the scope of an index check. | `2` |
| `logDir` | If set, each run appends to `logDir/YYYY/MM/YYYY-MM-DD.log`. | off |
| `ai` | `enabled`, `provider` (`claude` or `openai`), `model`, `maxSuggestions`. | off, `claude`, `claude-sonnet-4-20250514`, `10` |

Do not commit a config that holds your real vault path. Keep it in a local file and pass `--config`.

## Turn on AI suggestions

1. Set `ANTHROPIC_API_KEY` for Claude, or `OPENAI_API_KEY` for OpenAI, in your environment.
2. Run with `--ai`, or set `ai.enabled` to `true`.
3. Pick the provider with `--provider claude` or `--provider openai`.

## Run the pipeline in phases

The pipeline has three phases: scan, analyze, report. With no phase flag, all three run. With phase flags, only those phases run, in that fixed order. The last phase gives the output.

```bash
npm run dev -- --scan-only --output scan.json
npm run dev -- --analyze --input scan.json --output analysis.json
npm run dev -- --report --input analysis.json
```

Without `--input`, a phase runs its earlier phases in memory. Without `--output`, scan and analyze output goes to stdout. With `--report`, the report goes to the vault, or to stdout with `--dry-run`.

## All CLI options

| Option | Effect |
|---|---|
| `--vault <path>` | Override the vault path. |
| `--config <path>` | Use this config file. |
| `--ai` / `--no-ai` | Turn AI suggestions on or off. |
| `--provider <name>` | `claude` (default) or `openai`. |
| `--dry-run` | Print the report. Write no file. |
| `--json` | Print raw JSON for scripts. |
| `--verbose` | Print progress to stderr. |
| `--scan-only`, `--scan` | Include the scan phase. |
| `--analyze` | Include the analyze phase. |
| `--report` | Include the report phase. |
| `--input <file>`, `--output <file>` | Read or write phase data. |
| `--log-dir <path>` | Log to this directory. Overrides `logDir`. |
| `--apply` | Reserved. It exits with an error today. |

## Run it daily on macOS

1. Run `npm run setup:launchd`. It writes a LaunchAgent plist for a 06:00 daily run.
2. Run the `launchctl load` command that the script prints.

## Develop

| Command | Effect |
|---|---|
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm test` | Run the Vitest suite. A fixture vault is in `tests/fixtures/test-vault/`. |
| `npm run lint` | Run ESLint on `src/` and `tests/`. |
| `npm run format` | Run Prettier. |
| `npm run format:check` | Check formatting only. |

Code layout:

- `src/cli.ts`: CLI entry and exit codes.
- `src/run-pipeline.ts`: the three phases.
- `src/scanner.ts`: walks the vault and parses wiki-links.
- `src/resolver/`: resolves each link.
- `src/index-checker/`: checks Index and Overview pages.
- `src/ai-suggester.ts` and `src/ai-providers/`: AI prompts and the Claude and OpenAI calls.
- `src/reporter/`: builds and writes the report.
- `src/config.ts`: loads the config.

See also [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [LICENSE](LICENSE) (MIT).
