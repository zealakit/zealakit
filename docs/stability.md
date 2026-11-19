# Stability contract (draft)

zealakit is still a beta: nothing here is final, and no stable release is planned
in this cycle. This page lists what a future stable release intends to keep, and
the tests that pin each item **today**. Until then the contract may change — but
only deliberately: a change that breaks a contract test needs a `CHANGELOG.md`
**Breaking** entry in the same pull request.

## What is covered

| Contract                                                                                                                                                                                      | Pinned by                                                                                                        | Update path                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| CLI commands and flags (`create`, `add`, `info`, `doctor`, `outdated`, `preset`, `discovery`)                                                                                                 | `tests/unit/contract-cli.test.ts` compares each `--help` with `tests/fixtures/help/*.txt`                        | `UPDATE_SNAPSHOTS=1 pnpm test:unit` and review the diff                  |
| Exit codes `0` ok · `1` internal · `2` usage · `3` validation                                                                                                                                 | `tests/unit/cli-exit-codes.test.ts`                                                                              | —                                                                        |
| `zealakit.json`, `schemaVersion` 1                                                                                                                                                            | `schema/zealakit.schema.json`, `tests/unit/project-manifest.test.ts`, fixtures `tests/fixtures/projects/*-beta4` | New fields are additive; a different shape needs `schemaVersion` 2       |
| `info --json` (`schemaVersion`), `create --json`, `create --dry-run --json`, `add --json`, `doctor --json`, `outdated --json`, Discovery JSON API                                             | `schema/*.schema.json`, `tests/unit/contract-schemas.test.ts`                                                    | Additive fields are fine; removing/renaming a required field is breaking |
| Programmatic API: `@zealakit/core` and `@zealakit/core/ecosystem`                                                                                                                             | `tests/unit/api-public-exports.test.ts` locks the runtime exports                                                | `./internal` has **no** stability promise                                |
| `zealakit.json` for stacks, `schemaVersion` 2 (`schema/zealakit-stack.schema.json`); `recipe.json` (`schema/recipe.schema.json`); `create --stack --json` (`schema/stack-result.schema.json`) | `tests/unit/stack.test.ts`, `tests/unit/external-recipes.test.ts`                                                | v1 project manifests stay readable; v2 only appears at a stack root      |
| MCP tool names and protocol handshake (`zealakit mcp`)                                                                                                                                        | `tests/unit/mcp.test.ts`                                                                                         | New tools are additive; renaming/removing one is breaking                |
| `zealakit/api` types and runtime in the packed tarball                                                                                                                                        | `pnpm test:pack` (runs and type-checks it)                                                                       | —                                                                        |
| Ecosystem ids (`node`, `go`, `python`) in `zealakit.json`, `info --ecosystem` and the schemas                                                                                                 | `schema/*.json`, `tests/unit/python-ecosystem.test.ts`                                                           | New ecosystems are additive                                              |
| Upgrade path: projects made by an earlier beta keep working with `add`, `doctor`, `outdated`                                                                                                  | `tests/unit/contract-fixtures.test.ts`                                                                           | Regenerate fixtures only to add a new beta, never to hide a break        |

The schemas validate the _envelope_ of each output (required keys, enums, types).
Fields inside `info` metadata and Discovery `data` payloads may grow.

## Rules

1. **Additive is free.** New commands, flags, optional JSON fields, recipes and templates need no contract change.
2. **Breaking needs a note.** Removing or renaming a command, flag, required JSON field, exit code or `zealakit.json` field requires a `CHANGELOG.md` "Breaking" entry and updated snapshots/schemas in the same change.
3. **Deprecate before removing.** A deprecated command or flag prints a warning and is documented as deprecated for at least one beta before it is removed.
4. **The generated project is not covered.** Template and recipe _contents_ change between releases; use `zealakit outdated` / `zealakit add` to see and apply differences.

## Removed

- `zealakit [name] -t … -w …` (the root scaffold form) — deprecated earlier in this beta cycle, now removed; it exits `2` with a pointer to `zealakit create`. `zealakit --info` remains an alias of `zealakit info`.

## Currently deprecated

Nothing.

## Experimental

Nothing is marked experimental right now. The Discovery JSON API is **frozen under this contract** (see `docs/discovery-review.md`).
