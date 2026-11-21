# AGENTS.md

## Commands

- The one gate: `bash scripts/core-validate.sh` (file size, names, complexity, function length, parameters, nesting, duplication). Run it before you say a task is done.
- The workflow gate: `bash scripts/gha-validate.sh` (pin and permission checks, actionlint, zizmor).
- The writing gate: `bash scripts/writing-validate.sh` (vale, on files changed against main).
- The JavaScript gate: `bash scripts/js-validate.sh` (package check, eslint, tests).
- The TypeScript gate: `bash scripts/ts-validate.sh` (tsc, eslint, vitest).
- Install the gate tools once: `bash scripts/install-gate-tools.sh`, then add its PATH line to your shell.
- Turn on the hook once per clone: `git config core.hooksPath .githooks`. Never commit with `--no-verify`.

## Rules

- Reuse before you write. Search for an existing function or module first. Extend it instead of adding a near copy.
- Put variants in data and generic code. When two things differ only in a type or a value, write one function that takes it.
- Extract on the second real occurrence, not the first guess. Never merge code that looks alike but belongs to different domains.
- No boolean flag arguments. Two behaviors are two functions.
- Organize by domain (orders, billing, auth), not by kind (utils, helpers, managers). Dependencies point one way: edge to domain, never back.
- A function does one thing at one level of detail. Use guard clauses to return early. Keep it under 50 lines, under 10 branches, at most 4 parameters.
- Names say what a thing is or does. No `data`, `info`, `tmp`, `handle`, `process` as a whole name.
- Prefer composition and plain functions to inheritance. Keep side effects at the edges.
- Fail loudly: return or raise an error with context. Never swallow one. Comments say why, not what.
- Delete dead code and unused options. Concise means fewer concepts, not shorter names.
- A behavior change ships with a test that fails without it. Do not edit generated files; change the generator.
- Never edit a limit or a config to make a run pass. Fix the code. A waiver goes in `.core-allow` with a reason.

## GitHub Actions rules

- Pin every `uses:` to a full 40-character commit SHA with the version in a trailing comment. Dependabot keeps the pins current.
- Set `permissions: contents: read` at the top of every workflow. Raise it per job only where needed.
- Never put `${{ github.event... }}` or `${{ inputs.x }}` inside `run:`. Pass it through `env:`.
- Do not use `pull_request_target`. Set `persist-credentials: false` on checkout. Give every job `timeout-minutes`. No `secrets: inherit`.
- A new third-party action needs an entry in `.github/zizmor.yml`, added in review.

## JavaScript and TypeScript rules

- Use `===`, `const` and `let`, and ES modules with the `node:` prefix. Await or return every promise. Throw `Error` objects only.
- No `any`. No `@ts-ignore`. Parse outside data with a schema, not an `as` cast.
- Read `process.env` once at startup. Install from the lockfile with `npm ci`.
- Tests run with `npm test` (Vitest). A behavior change ships with a test that fails without it.

## Traps

- The files `scripts/*-validate.sh`, `scripts/core-*.py`, `scripts/workflow-check.py`, `scripts/package-check.mjs`, `scripts/writing-validate.sh`, `scripts/vale-central.ini` and `scripts/styles` come from the packs. Do not edit them. Fix the code instead.
- No function baseline exists: every function meets the limits. `.core-config` holds each changed limit with a reason.
- The gate tools are pinned with hashes in `ci-tools/` and `scripts/install-gate-tools.sh`. Change a version and its hash together.
- `.github/workflows/ci.yml` runs each gate once. Do not add the same gate to a second job.
