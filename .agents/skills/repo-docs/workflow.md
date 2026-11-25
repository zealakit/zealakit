# Workflow

Three procedures: **create**, **update**, **audit**. Every fact comes from a
source listed in the fact-source table of `SKILL.md`; the code wins over any
older README.

## Create (no docs, or boilerplate docs)

1. **Inventory the repository.** Read the manifest, scripts, `.env.example`,
   `Dockerfile`/compose, CI workflow, entry points and router files. Note the
   runtime version, port and every command a user could run.
2. **Confirm `profile.json`.** Check `units`, `layout`, `languages`, `sections`,
   `linkStyle`, `absoluteBase`, `internalSkills`, `userSkills`. Fix the profile
   before writing prose — every rule below reads it.
3. **Draft the source-language README** for each unit using the layout's section
   order. Fill tables from the inventory. If a section cannot be verified, write
   the verifiable part and leave the rest out; never write `TODO`.
4. **Translate** if `languages` has more than one entry: copy the structure
   (heading levels, code blocks, table shapes), translate only the prose. Keep
   commands, paths, keys and code identifiers unchanged.
5. **Run the checker** (`profile.check`, or `node
   .agents/skills/repo-docs/check-docs.mjs`). Fix until it passes. Report
   anything you could not verify to the user.

A generated project may start with a framework boilerplate README. Replace it
with the real layout; do not append to boilerplate.

## Update (after a code change)

Map the changed files to sections, edit only those, then run the checker:

| Changed file                          | Section                                   |
| ------------------------------------- | ----------------------------------------- |
| `package.json` / `pyproject.toml` / `Makefile` | Scripts (and Requirements if engines changed) |
| `.env.example`, settings/config       | Environment or Configuration               |
| router / controller / handler         | API, Jobs or Commands                     |
| `Dockerfile`, compose                 | Docker, Deployment                        |
| `.github/workflows/*`                 | CI                                        |
| new exported module / component       | API (library layout)                      |
| translated file drift                 | the matching translation of the section   |

Do not rewrite untouched sections. A table row is edited in place; a new fact
gets a new row.

## Audit (no edits unless asked)

1. Run the checker.
2. Re-verify every scripts table row against the manifest, every environment
   row against `.env.example` (both directions), every route against the
   router, every command against `--help`.
3. Report a findings list: file, section, what the doc claims, what the code
   says. Do not edit unless the user asks for the fix.

## Translation parity

`languages[0]` is the source language (`README.md`). Later languages are
`README_<CODE>.md` (upper-case code). Parity means:

- the sequence of heading levels is identical;
- the number and order of fenced code blocks is identical;
- every table has the same row and column count at the same position.

Prose, heading text and table cell text are translated; identifiers are not.

## Optional `docs/` pages

Off unless `docsDir.enabled` is `true`. Allowed pages: `architecture.md`,
`configuration.md`, `deployment.md`, `decisions/NNNN-title.md` (ADR). Rules:

- current behavior only — proposals go to `plans/`;
- the README links to every page;
- a page never repeats a README table; it explains or links.

## When the checker and the rule disagree

The checker encodes the rules. If a finding is a checker bug, fix the checker
in one change and add a case for it; do not disable the rule in `profile.json`.
