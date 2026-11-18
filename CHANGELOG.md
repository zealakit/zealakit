# Changelog

All notable changes. During the beta, contract-affecting changes are listed under **Breaking** (see `docs/stability.md`).

## 1.0.0-beta.4 (unreleased)

### Added

- `zealakit add <recipe...>` with diff preview, conflict handling and backups; project checks in `zealakit doctor`; `zealakit outdated`.
- `zealakit.json` project manifest (and `schema/zealakit.schema.json`), presets (`--preset`, `--config`, `zealakit preset`), `create --json`, `--pm/--install/--git`.
- Recipes: `vitest`, `tanstack-query`, `docker`, `docker-go`, `better-auth`, `nest-auth`, `github-actions`, `github-actions-go` and the Go recipes `goose` and `sqlc` (both need `postgres` or `mysql`, via the new `requiresAnyOf`) and `redis`.
- `zealakit outdated`, config `defaults` / `--config` for presets, and the Discovery review (`docs/discovery-review.md`: keep, freeze the JSON API).
- JSON Schemas for every machine-readable output, `docs/stability.md`, and contract tests.
- `zealakit/api` (published programmatic API with types, including `project.planAdd/applyAdd/check/outdated`), `zealakit mcp` (stdio MCP server), external data-only recipes (`-w ./dir`, `-w github:owner/repo/path#ref`, `zealakit recipe init|validate`, `externalRecipes` in `zealakit.json`) and stacks (`create --stack`, root `zealakit.json` `schemaVersion: 2`, `add --app`).

### Changed

- `@zealakit/core` is split into `.`, `./ecosystem` and `./internal`; core no longer prompts, colors output or exits.
- `-y` now documents "non-interactive, refuses a non-empty target"; `--force` overwrites.

### Removed

- The root scaffold form `zealakit [name] -t … -w …` (it exits `2` and points to `zealakit create`).

### Breaking

- **CLI:** the root scaffold form was removed (see above).
- `zealakit.json` may now have `schemaVersion: 2` at a stack root; tools reading manifests must handle both (`schemaVersion: 1` projects are unchanged).
- `RecipeConfig` carries a `manifest` payload instead of flat `packages`/`devDependencies`/`scripts` (ecosystem authors only; `defineRecipe` keeps the flat authoring shape).
