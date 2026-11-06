# Metadata query layer (`zealakit info`)

`@zealakit/core` exposes one shared, normalized metadata snapshot for:

- `zealakit info` (human + `--json`)
- external applications / future API or desktop integrations
- Discovery tooling (candidate retrieval only — scoring stays in `discovery/`)

Source of truth is unchanged: **constants** in `packages/core/src/constants/`,
**registry entries** in `packages/ecosystem-*`, **Discovery profiles** in
`packages/core/src/profiles/`. The `info/` module only reads them.

## Ownership

| Data                                                              | Owner                          |
| ----------------------------------------------------------------- | ------------------------------ |
| Scopes, UI frameworks, project types, categories, ecosystems      | `packages/core/src/constants/` |
| Templates + recipes (packages, overlays, transforms, agent entry) | ecosystem registries           |
| Discovery evaluation metadata (capabilities, modes, traffic fit)  | `packages/core/src/profiles/`  |
| Retrieval, normalization, filtering                               | `packages/core/src/info/`      |
| Terminal formatting, CLI flags, package.json metadata             | `apps/cli/src/info.ts`         |
| Hard constraints, scoring, ranking                                | `packages/core/src/discovery/` |

Core never reads the host `package.json`: the CLI passes its manifest through
`InfoOptions.cli`.

## API

```ts
import { getInfo, getTemplateMetadata, getRecipeMetadata, getTemplateIds } from "@zealakit/core";

const response = getInfo({ scope: "server", discovery: true }, { cli });
```

| Function                                                                                                                        | Result                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `getInfo(filter?, options?)`                                                                                                    | `InfoResponse` envelope (see below)              |
| `getTemplateMetadata(filter?)`                                                                                                  | `TemplateMetadata[]`                             |
| `getRecipeMetadata(filter?)`                                                                                                    | `RecipeMetadata[]`                               |
| `getTemplateIds(filter?)` / `getRecipeIds(filter?)`                                                                             | ids in registry order (used by Discovery)        |
| `getEcosystemMetadata` / `getScopeMetadata` / `getProjectTypeMetadata` / `getUiFrameworkMetadata` / `getRecipeCategoryMetadata` | vocabulary + membership                          |
| `getInfoRules(filter?)` / `getRuleMetadata(ids)`                                                                                | compatibility rules                              |
| `normalizeInfoFilter(raw)`                                                                                                      | validate string filters → typed filter or errors |

All returned objects are snapshots: registry configs, package maps, profile
arrays, and relation id lists are cloned/sorted. Mutating a response never
mutates the registry.

## Filters

| Filter        | Templates                                    | Recipes                                                      |
| ------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `ecosystem`   | `template.ecosystem ?? "node"`               | `recipe.ecosystem ?? path prefix`                            |
| `scope`       | exact `scope`                                | `supportedScopes` includes or `"all"`                        |
| `projectType` | Discovery profile includes it                | profile includes it (omitted `projectTypes` = all supported) |
| `uiFramework` | exact `uiFramework`                          | `uiFrameworks` includes it, or recipe is agnostic            |
| `templateId`  | exact id                                     | compatible with that template (`compat.ts`)                  |
| `recipeId`    | compatible with that recipe                  | exact id                                                     |
| `category`    | has a compatible recipe in that category     | `category` (or one of its categories)                        |
| `discovery`   | has a Discovery profile + attach `discovery` | has a Discovery profile + attach `discovery`                 |

Semantics: filters combine with **AND**; unknown values are rejected (never
silently ignored); contradictory filters return empty arrays, not an error.
`projectType: "complete-product"` (unsupported) returns no templates/recipes.

Relation ids inside the response (`compatibleRecipes`, `templates`,
`incompatibleTemplates`, `conflictsWith`, category members, rule recipes) are
restricted to the filtered set, so a filtered response never references a
hidden id.

## CLI

```bash
zealakit info
zealakit info --json
zealakit info --json --ecosystem node
zealakit info --json --scope server
zealakit info --json --template nest
zealakit info --json --recipe biome
zealakit info --json --project-type server-api --category orm
zealakit info --json --discover            # profiles included, no questionnaire
zealakit info --json --discover --scope server
```

`--discover` only enriches/filters metadata. It never starts the questionnaire,
runs scoring, or generates a project. The root alias `zealakit --info --json`
stays flag-compatible but has no filters; use `zealakit info` for filtered
queries.

## JSON envelope (schema v4)

```jsonc
{
  "schemaVersion": 4,
  "command": "info",
  "filters": { "scope": "server", "discovery": true }, // echo, stable key order
  "data": {
    "cli": { "name": "zealakit", "version": "...", "usage": { ... } }, // omitted when no CLI context
    "defaults": { "templateId": "vite-react", "noneValue": "none" },
    "ecosystems": [{ "id": "node", "label": "Node.js", "templates": [], "recipes": [] }],
    "scopes": [{ "id": "server", "templates": [], "recipes": [] }],
    "projectTypes": [{ "id": "server-api", "supported": true, "templates": [], "recipes": [] }],
    "uiFrameworks": [{ "id": "react", "templates": [], "recipes": [] }],
    "categories": [{ "id": "orm", "exclusive": true, "required": false, "auto": false, "recipes": [], "exclusiveRecipes": [], "nonExclusiveRecipes": [], "defaultRecipes": [] }],
    "templates": [{ "id": "nest", "discovery": { /* ResolvedTemplateProfile */ } }],
    "recipes": [{ "id": "prisma", "discovery": { /* ResolvedRecipeProfile */ } }],
    "rules": [{ "id": "scope-match", "description": "..." }]
  }
}
```

Notes:

- Every key is always present; filtered sections become empty arrays.
- Ordering is deterministic: registry order for entities, constant order for
  vocabulary, ASCII comparison for map keys.
- `discovery` appears only when `discovery: true` / `--discover`.
- JSON mode never prints ANSI, prompts, or Clack output. Invalid filters exit `2`
  with `{ schemaVersion, command, error: { code: "invalid-filter", details } }`.

## Migration from schema v3

v3 was a flat `KitInfo` (`templates`, `recipes`, `categories`, `rules`, `cli`,
`defaults`). v4 moves those fields under `data` and adds `command`, `filters`,
`ecosystems`, `projectTypes`, and `discovery` profiles. Field names inside
`data` are unchanged; `templates[].uiFramework` / `recipes[].uiFrameworks` are
still nullable and `path` / `hasAgentEntry` remain part of the contract.

## Discovery integration

`discovery/matching/engine.ts` and `constraints/template-constraints.ts` fetch
candidates through `getTemplateIds()` / `getRecipeIds()` instead of touching the
registry directly. Everything else (requirements resolution, hard constraints,
weights, ranking, reasons, defaults, dependency resolution) is unchanged.
