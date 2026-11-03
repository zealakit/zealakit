---

name: zealakit
description: >-
Zealakit repo architecture: recipe-based scaffolding CLI (templates, recipes,
overlays, registry, scaffolder, monitor). Use when working in this repository
root — editing src/, templates/, recipes/, scripts/, or monitor/ — or when
asking where files belong, how scaffolding works, or how to extend the kit.
Not for coding inside a generated consumer app.
---

# Zealakit

This repo is the **scaffolding kit**, not an end-user app. Agents must keep
kit conventions consistent across chats.

## What it is

CLI (`zealakit`) that copies a **template**, then applies **recipes** (packages,
files, transforms, agent entries) into a new project.

```
template → recipes (shared + overlay) → merge package.json → fileTransforms → agent-entry
```

## Top-level layout

| Path              | Role                                                     |
| ----------------- | -------------------------------------------------------- |
| `src/`            | CLI source (registry, scaffolder, prompts, validator)    |
| `templates/<id>/` | Base apps shipped with the kit (`vite-react`, `next`, …) |
| `recipes/<id>/`   | Optional layers applied on top of a template             |
| `scripts/`        | Kit tooling (e.g. `test-e2e-pack.ts`)                    |
| `monitor/`        | Internal dependency dashboard (`pnpm monitor`)           |
| `dist/`           | Built CLI (`tsup`) — do not hand-edit                    |

Published package contents: `dist` + `templates` + `recipes` (see root `package.json` `files`).

## Source (`src/`)

| File / dir              | Role                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `index.ts`              | Commander CLI entry                                                                           |
| `scaffolder.ts`         | Copy template/recipes, merge deps, transforms, agent entries                                  |
| `prompts.ts`            | Interactive `@clack/prompts` flow                                                             |
| `validator.ts`          | Name / exclusivity / scope checks                                                             |
| `constants.ts`          | **`SCOPES`**, **`RECIPE_CATEGORIES`**, **`UI_FRAMEWORK_CATEGORIES`** — single source of truth |
| `types.ts`              | Types derived from constants (`Scope`, `RecipeCategory`, configs)                             |
| `registry/templates.ts` | Template registry                                                                             |
| `registry/recipes.ts`   | Recipe registry (versions, overlays, transforms)                                              |
| `registry/index.ts`     | Re-exports                                                                                    |

Imports use ESM `.js` extensions in TypeScript source (`from "./types.js"`).

## Templates

- Registered in `src/registry/templates.ts` (`id`, `name`, `scope`, `path`, optional `overlay`).
- Folder: `templates/<path>/` (usually `path === id`).
- `overlay` defaults to `id` via `getTemplateOverlayId()` — recipe overlay folder under `recipes/*/overlays/<overlay>/`.
- Current templates: `vite-react` / `vite-vue` (`client`), `next` / `nuxt` (`hybrid`), `nest` / `hono` (`server`).
- Template-owned agent docs live under that template (`.agents/`, `AGENTS.md`) and ship into generated apps — **do not confuse with this kit’s root skills**.
- Everywhere agent skills/rules live in **`.agents/`**. **`.cursor`** is always a **symlink → `.agents`** (Cursor IDE compatibility).

## Recipes

Layout under `recipes/<id>/`:

```
recipes/<id>/
  shared/           # copied for every template
  overlays/<overlay>/  # e.g. vite-react, next — required if overlays/ exists
  scaffold/agent-entry.md  # lines inserted into generated AGENTS.md / CLAUDE.md
  .agents/          # skills/rules copied into the generated app
  .cursor -> .agents  # symlink only — do not store real content here
  …other files…    # copied unless inside shared|overlays|scaffold
```

Copy order in `copyRecipeFiles`:

1. Recipe root (excluding meta dirs)
2. `shared/`
3. `overlays/<overlayId>/` (must exist if `overlays/` is present)

For **`nuxt`**, after each recipe copy the scaffolder merges any recipe `src/` tree into `app/` and deletes `src/` (Nuxt `srcDir` is `app/`).

Registry fields (`RecipeConfig`): `packages`, `devDependencies`, `overlayPackages` / `overlayDevDependencies`, `scripts`, `fileTransforms`, `exclusive`, `default`, `supportedScopes`, `category` (one or many).

`fileTransforms` keys may be template id **or** overlay id. Failed pattern match throws.

Categories / scopes: always use / extend `src/constants.ts` — never duplicate string unions elsewhere.

## Coding conventions (kit)

- TypeScript ESM, strict; prefer `type` over `interface` when either works.
- Match existing style in the file you edit; minimal diffs.
- Recipe version pins live in `src/registry/recipes.ts` (and template `package.json` for base deps).
- After scaffold-behavior changes, update / run `pnpm test:pack` when relevant.
- Dependency UI for the kit: `pnpm monitor` (Root update runs `pnpm up`).

## Do / don’t

| Do                                                                          | Don’t                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Register templates/recipes in `src/registry/`                               | Add a template folder without registry entry               |
| Put cross-template recipe files in `shared/`                                | Put Next-only wiring in `shared/`                          |
| Add an overlay per supported family (`vite-react`, `next`, `nest`)          | Assume missing overlay is OK if `overlays/` exists         |
| Keep kit root `.agents/` (+ `.cursor` → `.agents`) for zealakit maintainers | Put kit maintainer docs only under `templates/*`           |
| Put skills/rules under `.agents/`                                           | Put real files only under `.cursor/` (must stay a symlink) |
| Derive types from `constants.ts`                                            | Hardcode scope/category lists in monitor or prompts        |

## Extending the kit

Detailed checklists: [extending.md](extending.md).

## Related

- Root agent entry: [AGENTS.md](../../../AGENTS.md)
- Rule: [.agents/rules/zealakit.mdc](../../rules/zealakit.mdc)
