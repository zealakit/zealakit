# Changelog

All notable changes. During the beta, contract-affecting changes are listed under **Breaking** (see `docs/stability.md`).

## 1.0.0-beta.4 (unreleased)

### Added

- `zealakit add <recipe...>` with diff preview, conflict handling and backups; project checks in `zealakit doctor`; `zealakit outdated`.
- `zealakit.json` project manifest (and `schema/zealakit.schema.json`), presets (`--preset`, `--config`, `zealakit preset`), `create --json`, `--pm/--install/--git`.
- Recipes: `vitest`, `tanstack-query`, `docker`, `docker-go`, `better-auth`, `nest-auth`, `github-actions`, `github-actions-go` and the Go recipes `goose` and `sqlc` (both need `postgres` or `mysql`, via the new `requiresAnyOf`) and `redis`.
- `zealakit outdated`, config `defaults` / `--config` for presets, and the Discovery review (`docs/discovery-review.md`: keep, freeze the JSON API).
- JSON Schemas for every machine-readable output, `docs/stability.md`, and contract tests.

### Changed

- `@zealakit/core` is split into `.`, `./ecosystem` and `./internal`; core no longer prompts, colors output or exits.
- `-y` now documents "non-interactive, refuses a non-empty target"; `--force` overwrites.

### Deprecated

- The root scaffold form `zealakit [name] -t … -w …` — use `zealakit create`.

### Breaking

- `RecipeConfig` carries a `manifest` payload instead of flat `packages`/`devDependencies`/`scripts` (ecosystem authors only; `defineRecipe` keeps the flat authoring shape).
