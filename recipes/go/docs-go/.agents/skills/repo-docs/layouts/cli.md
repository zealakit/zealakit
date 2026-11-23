---
layout: cli
required:
  - Install
  - Quick start
  - Commands
  - Configuration
  - Exit codes
  - License
recipeSections: []
---

# CLI layout

Command-line tool or scaffolding kit.

1. **H1** — tool name plus a one-line tagline (what it makes, for whom).
2. **Install** — every supported install path: `npx`, global install, version
   pinning. State the runtime requirement here, not in a separate section.
3. **Quick start** — the shortest path from install to a useful result.
4. **Commands** — one H3 per command (`### command`), each with a synopsis code
   block, a flags table and one example. Flags must match `--help`; the
   `--help` snapshot is the fact source.
5. **Configuration** — config files, keys, precedence, environment variables.
   A table of keys, then one example file.
6. **Exit codes** — table: code → meaning. Codes are a contract; list every one
   the CLI can return, including usage and validation errors.
7. **License** — one line.

Commands, flags and exit codes in the README must be generated from (or checked
against) the real `--help` output and the exit-code constants.
