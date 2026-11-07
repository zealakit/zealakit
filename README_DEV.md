# Zealakit — maintainer notes

Developer-facing notes for working on this repository. End-user docs live in [README.md](README.md).

## Metadata for tooling

```bash
npx zealakit@latest info --json
npx zealakit@latest info --json --scope server
npx zealakit@latest info --json --template nest
npx zealakit@latest info --json --discover
```

`info` reads the live registry through the shared metadata layer in
`packages/core/src/info/` (no duplicated mapping in the CLI). JSON output is one
versioned envelope, and stdout contains nothing else — no ANSI, no prompts:

```jsonc
{
  "schemaVersion": 4,
  "command": "info",
  "filters": { "scope": "server" }, // echo of the applied filter
  "data": {
    "cli": { "name": "zealakit", "version": "…", "usage": { … } },
    "defaults": { "templateId": "vite-react", "noneValue": "none" },
    "ecosystems": [{ "id": "node", "label": "Node.js", "templates": [], "recipes": [] }],
    "scopes": [{ "id": "server", "templates": [], "recipes": [] }],
    "projectTypes": [{ "id": "server-api", "supported": true, "templates": [], "recipes": [] }],
    "uiFrameworks": [{ "id": "react", "templates": [], "recipes": [] }],
    "capabilities": [{ "id": "database", "templates": [], "recipes": [] }],
    "categories": [{ "id": "orm", "exclusive": true, "recipes": [], "…": "…" }],
    "templates": [{ "id": "nest", "promptSteps": [], "discovery": { "…": "…" } }],
    "recipes": [{ "id": "prisma", "templates": [], "discovery": { "…": "…" } }],
    "rules": [{ "id": "scope-match", "description": "…" }]
  }
}
```

- Filters: `--ecosystem`, `--scope`, `--project-type`, `--ui-framework`,
  `--capability`, `--template`, `--recipe`, `--category`, `--discover`. They combine with AND
  semantics; unknown values exit `2` with diagnostics on stderr (stdout stays
  empty) instead of being ignored.
- `--discover` only attaches Discovery profiles (`templates[].discovery`,
  `recipes[].discovery`) and keeps Discovery-eligible entries. It never asks
  questionnaire questions, runs scoring, or generates a project.
- `schemaVersion` changes only on breaking changes; field names inside `data`
  are stable. Full contract and migration notes: [docs/metadata-query-layer.md](docs/metadata-query-layer.md).
- The root alias `zealakit --info --json` is kept for compatibility but has no
  filters; use `zealakit info` for filtered queries.

Without `--json`, `info` prints a human-readable summary that respects the same
filters.

## Discovery JSON API

Stateless Discovery operations are exposed through the existing `discovery`
command group:

```bash
echo '{"schemaVersion":1,"operation":"questions","answers":{}}' | pnpm -s zealakit discovery query
```

Operations: `questions`, `recommendations`, `validate`, `scaffold`; one JSON
response on stdout, schema version `1`. The caller resubmits accumulated
answers. `scaffold` requires `confirmation.confirmed: true` and reuses the normal
scaffold pipeline. Contract and exit codes:
[docs/discovery-json-api.md](docs/discovery-json-api.md).

## Repository layout

This repo is a pnpm monorepo. The published npm package remains **`zealakit`**
(root); workspace packages are private and bundled into `dist/`.

```text
apps/cli/                         # CLI entry (flags, prompts, formatting, doctor)
packages/core/
  src/constants/                  # scopes, ecosystems, categories, discovery enums
  src/registry/                   # mutable catalog filled at startup
  src/compat.ts                   # recipe × template compatibility
  src/scaffold/                   # plan → stage → validate → commit
  src/profiles/                   # Discovery profiles (advisory metadata)
  src/info/                       # shared metadata queries + filters (info --json)
  src/prompts/                    # interactive create step metadata
  src/discovery/                  # questionnaire + matching/scoring
packages/ecosystem-node/          # Node registry + npm package.json adapter
packages/ecosystem-go/            # Go templates + recipes + toolchain detection
templates/node/<id>/              # Node base templates
templates/go/stdlib-api/          # Go stdlib HTTP API template
templates/go/gin-api/             # Go Gin HTTP API template
templates/go/stdlib-worker/       # Go stdlib background worker
recipes/node/<id>/                # Node recipes
recipes/go/                       # Go recipes (postgres, mysql, mongodb)
docs/                             # maintainer contracts (metadata query layer)
```

Metadata ownership is intentional:

| Data                                                | Owner                          |
| --------------------------------------------------- | ------------------------------ |
| Scopes, project types, categories, ecosystems       | `packages/core/src/constants/` |
| Template/recipe registry entries                    | `packages/ecosystem-*`         |
| Discovery evaluation profiles                       | `packages/core/src/profiles/`  |
| Query, normalization, filtering                     | `packages/core/src/info/`      |
| Human/JSON output, CLI flags, package.json metadata | `apps/cli/src/info.ts`         |
| Hard constraints, scoring, ranking                  | `packages/core/src/discovery/` |

Adding a template or recipe does not require touching `info`: register it in the
ecosystem package and add its Discovery profile — the query layer, prompts, and
`info --json` pick it up automatically. New enums still belong in
`packages/core/src/constants/`, never in a query or CLI file.

## Documentation and packaging

Public documentation lives at the repository root:

- `README.md` — default npm README (English).
- `README_VI.md` — Vietnamese.
- `README_CN.md` — Chinese.
- `README_DEV.md` — this maintainer document; never shipped.

The root `package.json` `files` allowlist includes the three public READMEs,
`dist/`, `templates/`, `recipes/`, and excludes `README_DEV.md`. `npm` uses
`README.md` as the package README. Do not copy docs into `dist/`; `tsup` owns
that directory.

Release artifact flow:

```bash
pnpm build
npm pack
```

Inspect the tarball before publishing:

```bash
tar -tzf zealakit-*.tgz | grep -E 'package/(README|LICENSE|dist)/'
tar -tzf zealakit-*.tgz | grep README_DEV # must be empty
```

The package is assembled from the repository root, not from `apps/cli/dist`.
Build output is generated; do not edit it by hand.

## Working on the metadata layer

- Put retrieval/normalization in `packages/core/src/info/queries.ts`, filter
  validation in `filters.ts`, and stable types in `types.ts`. Do not special-case
  ids in `getInfo`.
- Return snapshots: clone arrays/maps and sort keys deterministically; never
  expose registry objects by reference.
- Discovery retrieves candidates via `getTemplateIds()` / `getRecipeIds()`.
  Constraints, scoring, and ranking stay in `discovery/` — do not move them into
  `info/`.
- Tests: `tests/unit/info-query.test.ts` (core queries/filters) and
  `tests/unit/info.test.ts` (CLI + JSON contract); `pnpm test info` covers both
  files (file-path suites match the pattern too).
- After changing the JSON shape, bump `INFO_SCHEMA_VERSION` and update
  `docs/metadata-query-layer.md` and `scripts/test-e2e-pack.ts`.

## Programmatic API

`@zealakit/core` exposes `createZealakit()` for TypeScript consumers (metadata,
Discovery, plan, scaffold) without the CLI; register ecosystems explicitly with
`nodeEcosystem` / `goEcosystem`. See [docs/programmatic-api.md](docs/programmatic-api.md).
The published `zealakit` package remains CLI-only in this release.

## Release

See [docs/release.md](docs/release.md) for the repeatable release checklist.

## Verification

```bash
pnpm check        # Biome (includes markdown table formatting)
pnpm typecheck    # core, ecosystems, cli, tests, scripts, monitor
pnpm test         # unit + in-process scaffold tests
pnpm test:pack    # build → pack → tarball smoke test (release gate)
pnpm test:integration  # install the packed CLI in an independent fixture
pnpm test:go           # generated Go recipes: go mod tidy / test / vet
```

Check the environment (Go is optional; TypeScript workflows work without it):

```bash
npx zealakit@latest doctor
npx zealakit@latest doctor --json
```
