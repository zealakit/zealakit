---
name: repo-docs
description: >-
  Create, update, and audit this repository's documentation (README hub plus
  per-package spokes, translations, optional docs/ pages). Use when writing or
  reviewing README files, API or architecture docs, or when checking that
  documented commands, environment variables and routes still match the code.
---

# Repo docs

One system for every README and `docs/` page in this repository.

## When to load

- Creating documentation for a repository that has none (or only boilerplate).
- Updating docs after a code change (script, env key, route, dependency).
- Auditing docs against the code without editing.

## Read these first

1. `profile.json` in this folder — every repository-specific fact lives there.
2. Only the layout files named by `profile.units[].layout`:
   `layouts/app.md`, `layouts/service.md`, `layouts/worker.md`,
   `layouts/cli.md`, `layouts/library.md`, `layouts/monorepo.md`.
3. `workflow.md` for the create / update / audit procedure.
4. `checklist.md` before you finish.

Do not open every layout. Do not copy values out of `profile.json` into other
files — rules reference profile keys, not literal values.

## Source of truth

The code is the source of truth. A fact you cannot verify in the repository is
written as prose ("configure your database URL") or left out — never invented,
never `TODO`.

| Fact                 | Node                                   | Go                                    | Python                                 |
| -------------------- | -------------------------------------- | ------------------------------------- | -------------------------------------- |
| Scripts / commands   | `package.json` `scripts`               | `Makefile`, `go run ./cmd/...`        | `pyproject.toml`, `uv run ...`         |
| Runtime version      | `engines`, `.nvmrc`, `.node-version`   | `go.mod` `go` line                    | `requires-python`, `.python-version`   |
| Environment keys     | `.env.example`, config module          | `.env.example`, config package        | `.env.example`, settings class         |
| Port / routes        | framework config, router files         | `http.Handle*`, gin router            | FastAPI routers                        |
| Optional features    | recipe files, `README` sections of the recipe skill | recipe files             | recipe files                           |

## Core rules

- **Profile first.** `projectName`, `units`, `layout`, `sections`, `languages`,
  `linkStyle`, `absoluteBase`, `internalSkills` and `userSkills` are read from
  `profile.json`. Change the profile when a fact changes; do not fork the rules.
- **Hub + spoke.** The root README (`dir: ""`) navigates; a unit README holds
  that unit's API. Never repeat a child's API table in the hub.
- **Fixed section order.** Each layout defines the required H2 sections and
  their order. Extra sections are allowed; required ones are not reordered.
- **Tables for enumerable facts.** Scripts, environment variables, commands,
  packages and routes are tables. One row per fact; no prose lists.
- **Copy-pasteable code blocks.** Every command is complete (`pnpm add x`, not
  "install x"), one command per block when it is a step.
- **Voice.** Short, active, present tense. Address the reader as "you". No
  marketing adjectives, no exclamation marks, no "simply" or "just".
- **Links.** `profile.linkStyle: "absolute"` means every link is absolute
  (GitHub/npm), images end in `?raw=true`. `"relative"` means links resolve to
  files in the repository. Anchors (`#section`) are always allowed.
- **Internal vs user-facing.** Agent skills live under `profile.internalSkills`.
  User-facing docs never link into `.agents/`; user docs live under
  `profile.userSkills` when the repository publishes them.
- **Plans vs docs.** `plans/` holds proposals; documentation describes current
  behavior. Never document an unshipped plan as if it existed.
- **No `TODO`.** Finish the section or leave it out.
- **The checker is the gate.** Run it after every edit (see `profile.check`).
  Fix errors; do not weaken the profile to hide them.

## Modes

- **Create** — inventory the repository, confirm the profile, draft the
  source-language README, translate if configured, run the checker.
- **Update** — map changed files to sections, edit only those, run the checker.
- **Audit** — run the checker, re-verify tables against their fact source,
  report findings without editing unless asked.

Full procedures: [workflow.md](workflow.md). Final pass:
[checklist.md](checklist.md).

## Commands

```bash
# Node projects with the docs recipe
pnpm docs:check

# Any project (zero-dependency checker shipped with this skill)
node .agents/skills/repo-docs/check-docs.mjs
```

The checker reads `profile.json` and this folder's `layouts/*.md`; it validates
the H1, required sections and their order, link style, translation parity,
scripts/environment tables when present, and forbidden placeholders.
