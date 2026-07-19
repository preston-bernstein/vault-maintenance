# FileBot CLI analysis and application to vault-maintenance

This document summarizes how [FileBot](https://www.filebot.net/cli.html) structures its CLI (modes, flags, output, dry run) and how we can align vault-maintenance with those patterns.

## How FileBot does it

### 1. Mode flags (verbs) — “what to do”

FileBot uses **primary mode flags** that act as verbs. Each mode is a distinct capability:

| Flag | Purpose |
|------|--------|
| `-rename` | Rename/organize media files |
| `-get-subtitles` | Fetch missing subtitles |
| `-check` | Compute or verify checksums (SFV) |
| `-extract` | Extract archives |
| `-list` | Print episode list (e.g. from a DB) |
| `-find` | Print file paths |
| `-mediainfo` | Print media info |
| `-script` | Run a Groovy script |
| `-revert` | Undo rename operations |

Design points:

- **Single responsibility**: “Simple commands that do one thing and do it well.”
- **Short, verb-like names**: `-rename`, `-list`, `-find` (single word, no `--` in docs; CLI uses `-` for main modes).
- **No mutual exclusivity**: You can combine modes. Order of flags implies workflow.

### 2. Stacking / combining modes

Combining modes changes the **workflow**, not “run only one”:

- **`-list -rename`** → “Linear rename mode”: fetch episode list, then rename files in that order (first file → first episode, etc.).
- **`-find -exec`** → Find files, then run a command on them.

So:

- **No flags** → default or error (FileBot typically requires a mode).
- **One mode** → do that one thing.
- **Multiple modes** → run those steps in sequence; the combination has a defined meaning (e.g. list then rename).

Output is determined by the **primary** or **last** action (e.g. rename writes files; list prints to console).

### 3. `--action` (how to apply changes)

For **rename**, FileBot doesn’t use a global “dry run” flag. Instead it uses **`--action`** to choose what to do with the computed result:

| Value | Meaning |
|-------|--------|
| `move` | Move files (default) |
| `copy` | Copy |
| `symlink` / `hardlink` | Link |
| `duplicate` / `clone` | Duplicate with optional `--output` |
| **`test`** | **Dry run** — show what would happen, no changes |

So “dry run” is **one of the actions** for the rename operation, not a separate top-level flag. That keeps “rename” as the single verb and makes “test” a parameter of how rename is applied.

### 4. `--output` (contextual)

`--output` meaning depends on the mode:

- **Rename**: output **folder** (with `--action duplicate/copy` etc.).
- **Subtitles**: output **format** (e.g. `srt`).
- **Checksum**: verification **file** (e.g. SFV).

So “output” is “where/how to write the result of this mode,” not a single global “output file” for everything.

### 5. Input: positional arguments

FileBot takes **positional arguments** as input (files or folders), e.g.:

```bash
filebot -rename *.mkv
filebot -rename -r "/path/to/files"
```

There is no `--input` for “prior phase output”; multi-step handoff is done by **stacking modes** in one run (e.g. `-list -rename`) or by **scripts** for more complex flows.

### 6. Other patterns

- **`--apply`**: In FileBot this is “apply post-processing” (artwork, nfo, date, import, prune) — a separate concern from the main action.
- **`--log`**: Log level (e.g. `all | info | warning`).
- **`-version`**, **`-help`**: Standard.
- **`--conflict`**: How to resolve conflicts (skip, replace, fail, etc.) — relevant when the action writes files.

---

## Mapping to vault-maintenance

| FileBot concept | vault-maintenance today | Notes |
|-----------------|-------------------------|--------|
| Mode flags (verbs) | `--scan-only`, `--analyze`, `--report` | We use “phase” flags; FileBot uses mode names like `-rename`, `-list`. |
| Stacking modes | We allow stacking; output = last phase | Aligned: combine phases, output is the last. |
| Default (no flags) | Full pipeline (read → analyze → report) | We have a default; FileBot often requires a mode. |
| Dry run | `--dry-run` (global) | FileBot uses `--action test` inside rename. We could keep global or introduce “report action”. |
| Output | `--output <file>` for scan/analyze phase output | Similar to FileBot’s contextual `--output` (folder/format/file). |
| Input | `--input <file>` for prior phase (scan or analysis JSON) | We need this for cross-run handoff; FileBot uses positionals + stacked modes. |
| Apply | `--apply` (reserved, enact phase) | FileBot’s `--apply` is post-processing; ours is “apply changes to vault.” |

---

## Recommendations for vault-maintenance

### 1. Align naming with “mode” style (optional)

- Consider **shorter, verb-like** phase flags so they read like FileBot’s modes:
  - `--scan` (or keep `--scan-only` to stress “only this if combined”).
  - `--analyze` (already good).
  - `--report` (already good).
- If we want to mirror FileBot’s single-dash style for “modes,” we could use `-scan`, `-analyze`, `-report` in docs and implementation (Commander supports both). This is optional; current names are clear.

### 2. Keep stacking semantics

- **No flags** → full pipeline.  
- **One or more of `--scan-only`, `--analyze`, `--report`** → run those phases in order; **output = last phase**.  
This already matches the “combine modes, output from last” idea. No change required.

### 3. Dry run: keep global or make contextual

- **Current**: `--dry-run` means “report phase prints to stdout, doesn’t write a file.”  
- **FileBot-like**: We could introduce something like `--action test` for the **report** phase only (e.g. “compute report but don’t write; print to stdout”).  
Recommendation: **keep `--dry-run`** for simplicity. We only have one phase that writes to the vault (report). If we add an “enact” phase (e.g. `--apply`), we could add `--action test` for that phase later (“show what would be applied”) and keep `--dry-run` for report.

### 4. Document `--output` as contextual

- **Scan / analyze as last phase**: `--output <file>` writes that phase’s JSON.  
- **Report as last phase**: report is written to vault (or stdout with `--dry-run`); no `--output` for report.  
Document this in the same way FileBot documents `--output` per mode (see README/CLAUDE).

### 5. Keep `--input` for phased handoff

We need `--input` to feed a previous run’s JSON into the next phase when not stacking (e.g. `--analyze --input scan.json`). FileBot doesn’t need this because they use stacked modes or scripts. Our design is appropriate for “run phases in separate invocations.”

### 6. Future `--apply` (enact)

When we implement enact:

- Treat it like a **mode** (or phase): “apply changes to vault.”
- Consider a **`--action test`** (or `--dry-run` for apply) to show what would be applied without writing. That would mirror FileBot’s `--action test` for rename.

---

## Summary

| Aspect | FileBot | vault-maintenance (recommended) |
|--------|--------|----------------------------------|
| Modes | `-rename`, `-list`, `-check`, etc. | `--scan-only`, `--analyze`, `--report` (optionally shorten to `--scan`, etc.) |
| Stacking | Combine modes; order defines workflow | Keep: stack phases; output = last phase |
| Default | Often “must specify mode” | Keep: no flags = full pipeline |
| Dry run | `--action test` for rename | Keep: `--dry-run` for report; later add test/dry-run for `--apply` |
| Output | Contextual per mode | Document: `--output` only when last phase is scan or analyze |
| Input | Positional args; no `--input` | Keep: `--input` for prior phase JSON in multi-run workflows |

The main architectural idea to carry over: **mode/phase flags are additive and stackable; they define which steps run and in what order; output is the result of the last step.** We already follow that. The rest is naming, documentation, and optional refinements (e.g. `--action test` for a future apply phase).

---

## Implemented (vault-maintenance)

The following alignments are in place:

1. **`--scan` alias** — `--scan` is supported as a short form of `--scan-only` (read phase). CLI normalizes to `scanOnly`; pipeline accepts both `scanOnly` and `scan` in options.
2. **Contextual `--output`** — Documented in README and CLAUDE: `--output` is used only when the last phase is scan or analyze; when the last phase is report, output goes to the vault or stdout with `--dry-run`, and `--output` is ignored. Tests assert that with report as last phase and `--output` set, the report is on stdout and the output file is not created.
3. **`--dry-run`** — Documented as applying to the report phase (print to stdout, don’t write file); note added that a future enact phase may support its own dry-run.
4. **Stacking** — README and CLAUDE describe phase flags as stackable and that output = last phase’s result; README references this doc for the FileBot-style design.
5. **Tests** — Phase tests cover: `--scan-only` and `--scan` (alias), `--analyze --input`, `--report --input`, stacked `--scan-only --analyze`, contextual `--output` (ignored when report last), and full pipeline with no phase flags.
