# Stability contract (draft)

zealakit is still a beta: nothing here is final, and no stable release is planned
in this cycle. This page lists what a future stable release intends to keep, and
the tests that pin each item **today**. Until then the contract may change — but
only deliberately: a change that breaks a contract test needs a `CHANGELOG.md`
**Breaking** entry in the same pull request.

## What is covered

| Contract                                                                                                                                          | Pinned by                                                                                                        | Update path                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CLI commands and flags (`create`, `add`, `info`, `doctor`, `outdated`, `preset`, `discovery`)                                                     | `tests/unit/contract-cli.test.ts` compares each `--help` with `tests/fixtures/help/*.txt`                        | `UPDATE_SNAPSHOTS=1 pnpm test:unit` and review the diff                  |
| Exit codes `0` ok · `1` internal · `2` usage · `3` validation                                                                                     | `tests/unit/cli-exit-codes.test.ts`                                                                              | —                                                                        |
| `zealakit.json`, `schemaVersion` 1                                                                                                                | `schema/zealakit.schema.json`, `tests/unit/project-manifest.test.ts`, fixtures `tests/fixtures/projects/*-beta4` | New fields are additive; a different shape needs `schemaVersion` 2       |
| `info --json` (`schemaVersion`), `create --json`, `create --dry-run --json`, `add --json`, `doctor --json`, `outdated --json`, Discovery JSON API | `schema/*.schema.json`, `tests/unit/contract-schemas.test.ts`                                                    | Additive fields are fine; removing/renaming a required field is breaking |
| Programmatic API: `@zealakit/core` and `@zealakit/core/ecosystem`                                                                                 | `tests/unit/api-public-exports.test.ts` locks the runtime exports                                                | `./internal` has **no** stability promise                                |
| Upgrade path: projects made by an earlier beta keep working with `add`, `doctor`, `outdated`                                                      | `tests/unit/contract-fixtures.test.ts`                                                                           | Regenerate fixtures only to add a new beta, never to hide a break        |

The schemas validate the _envelope_ of each output (required keys, enums, types).
Fields inside `info` metadata and Discovery `data` payloads may grow.

## Rules

1. **Additive is free.** New commands, flags, optional JSON fields, recipes and templates need no contract change.
2. **Breaking needs a note.** Removing or renaming a command, flag, required JSON field, exit code or `zealakit.json` field requires a `CHANGELOG.md` "Breaking" entry and updated snapshots/schemas in the same change.
3. **Deprecate before removing.** A deprecated command or flag prints a warning and is documented as deprecated for at least one beta before it is removed.
4. **The generated project is not covered.** Template and recipe _contents_ change between releases; use `zealakit outdated` / `zealakit add` to see and apply differences.

## Currently deprecated

- `zealakit [name] -t … -w …` (the root scaffold form): use `zealakit create`. It prints a warning and is scheduled for removal in a later beta.

## Experimental

Nothing is marked experimental right now. The Discovery JSON API is **frozen under this contract** (see `docs/discovery-review.md`).
