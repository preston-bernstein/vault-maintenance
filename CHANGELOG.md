# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Multi-provider AI support: Claude and OpenAI (`--provider claude|openai`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`)
- Project structure: pipeline in `run-pipeline.ts`, AI providers in `ai-providers/`, report sections in `reporter/sections.ts`, resolver and index-checker split into focused modules

### Changed

- Refactored into smaller, single-purpose files for readability and maintenance
- Report generation: single pass over index reports (no duplicate filter), pre-allocated resolution array, slash-count for scope depth (no string split)
- File-level and step comments across the codebase; named constant for AI minimum confidence

## [1.0.0] - 2025-02-08

### Added

- CLI to scan Obsidian vaults for wiki-link issues
- Detection of broken links, ambiguous links (same name in multiple folders), and stale index/overview files
- Markdown report output (written to vault or stdout with `--dry-run`)
- Optional AI suggestions for broken links via Claude API (`ANTHROPIC_API_KEY`)
- Config file support (`vault-maintenance.config.json`) with vault path, exclude patterns, report folder, index depth, and AI options
- CLI options: `--vault`, `--config`, `--ai` / `--no-ai`, `--dry-run`, `--json`, `--verbose`
- macOS LaunchAgent setup script for scheduled runs (`npm run setup:launchd`)
