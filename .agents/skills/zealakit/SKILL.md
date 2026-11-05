---

name: zealakit
description: >-
Zealakit repo architecture: recipe-based scaffolding CLI (templates, recipes,
overlays, registry, scaffolder, monitor). Use when working in this repository
root — editing apps/, packages/, templates/, recipes/, scripts/, or monitor/ —
or when asking where files belong, how scaffolding works, or how to extend the
kit. Not for coding inside a generated consumer app.
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

| Path                             | Role                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `apps/cli/`                      | Commander CLI entry, prompts, info, preview                                  |
| `packages/core/`                 | Ecosystem-independent engine (scaffold, compat, registry catalog, contracts) |
| `packages/ecosystem-typescript/` | TS/JS templates+recipes registry, npm manifest adapter                       |
| `templates/typescript/<id>/`     | Base apps shipped with the kit                                               |
| `templates/go/`                  | Reserved (no Go templates yet)                                               |
| `recipes/typescript/<id>/`       | Optional layers applied on top of a template                                 |
| `recipes/go/`                    | Reserved (no Go recipes yet)                                                 |
| `scripts/`                       | Kit tooling (test runner, pack smoke, pack dotfiles)                         |
| `tests/`                         | `unit/` + in-process `scaffold/` tests (`pnpm test`)                         |
| `monitor/`                       | Internal dependency dashboard (`pnpm monitor`)                               |
| `dist/`                          | Built CLI (`tsup`) — do not hand-edit                                        |

Published package (root `zealakit`): `dist` + `templates` + `recipes`. Workspace packages are private and bundled into `dist/`.

## Packages

### `@zealakit/core`

| Area                        | Role                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `constants.ts` / `types.ts` | Scopes, frameworks, categories, config types                 |
| `compat.ts`                 | Can recipe X go on template Y?                               |
| `resolve-recipes.ts`        | Expand `dependsOn`, cycles, order                            |
| `registry/`                 | Mutable catalog (`registerTemplate` / `registerRecipe`)      |
| `scaffold/`                 | plan → stage → validate → commit; paths; transforms          |
| `scaffold/manifest.ts`      | `ManifestAdapter` contract (plan/apply merges, project name) |
| `validation/`               | Recipe/template/target checks (project name via adapter)     |

### `@zealakit/ecosystem-typescript`

| Area                       | Role                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `registry/templates.ts`    | TypeScript template list (`path: typescript/<id>`)          |
| `registry/recipes/<id>.ts` | One module per recipe (`defineRecipe`; monitor edits these) |
| `manifest/`                | npm `package.json` merge + conflict plan                    |
| `index.ts`                 | `registerTypescriptEcosystem()`                             |

### `@zealakit/cli`

| File                                                  | Role                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `index.ts`                                            | Commander entry; registers TypeScript ecosystem then runs |
| `prompts.ts` / `prompt-steps.ts` / `prompt-labels.ts` | Interactive flow                                          |
| `info.ts` / `preview.ts` / `manifest.ts`              | Metadata, dry-run, kit package.json                       |

Imports use ESM `.js` extensions in TypeScript source (`from "./types.js"`).

## Templates

- Registered in `packages/ecosystem-typescript/src/registry/templates.ts`.
- Folder: `templates/<path>/` where `path` is `typescript/<id>`.
- `overlay` defaults to `id` via `getTemplateOverlayId()` — recipe overlay folder under `recipes/typescript/*/overlays/<overlay>/`.
- Current templates: `vite-react` / `vite-vue` / `astro-react-client` (`client`), `astro-react-hybrid` / `next` / `nuxt` (`hybrid`), `nest` / `hono` (`server`).
- Template-owned agent docs live under that template (`.agents/`, `AGENTS.md`) and ship into generated apps — **do not confuse with this kit’s root skills**.
- Everywhere agent skills/rules live in **`.agents/`**. **`.cursor`** is always a **symlink → `.agents`** (Cursor IDE compatibility).

## Recipes

Layout under `recipes/typescript/<id>/`:

```
recipes/typescript/<id>/
  shared/           # copied for every template
  overlays/<overlay>/  # e.g. vite-react, next — required if overlays/ exists
  scaffold/agent-entry.md  # lines inserted into generated AGENTS.md / CLAUDE.md
  .agents/          # skills/rules copied into the generated app
  .cursor -> .agents  # symlink only — do not store real content here
  …other files…    # copied unless inside shared|overlays|scaffold
```

Copy order in `copyRecipe` (`packages/core/src/scaffold/copy.ts`):

1. Recipe root (excluding meta dirs)
2. `shared/`
3. `overlays/<overlayId>/` (must exist if `overlays/` is present)

Templates with `srcDir` other than `src` (**`nuxt`** → `app/`): after each recipe copy the scaffolder folds any recipe `src/` tree into `srcDir` and deletes `src/`.

Registry fields (`RecipeConfig`): `packages`, `devDependencies`, `overlayPackages` / `overlayDevDependencies`, `scripts`, `fileTransforms`, `exclusive`, `default`, `supportedScopes`, `frameworks`, `category` (one or many), `hint`, `finalize`, optional `path` (defaults via `defineRecipe` to `typescript/<id>`).

- `frameworks` (e.g. `["react"]`) restricts a recipe to templates with that `framework`; omit for framework-agnostic recipes. Never hardcode recipe ids in prompts/validation.
- `supportedScopes` is matched strictly (`hybrid` does **not** accept `server`-only recipes). ORM recipes list both `server` and `hybrid`; hybrid prompts / dry-run / scaffold print a small-project caveat (prefer a dedicated backend framework for production APIs).
- `fileTransforms` keys may be template id **or** overlay id. Failed pattern match throws.
- `finalize(targetDir)` runs after all recipes are copied (e.g. Biome drops nested `root: false`).
- npm never packs `.gitignore`: `prepack` ships templates' `_gitignore`, the scaffolder renames it back.

Categories / scopes: always use / extend `packages/core/src/constants.ts` — never duplicate string unions elsewhere.

## Coding conventions (kit)

- TypeScript ESM, strict; prefer `type` over `interface` when either works.
- Match existing style in the file you edit; minimal diffs.
- Recipe version pins live in `packages/ecosystem-typescript/src/registry/recipes/<id>.ts` (and template `package.json` for base deps).
- After scaffold-behavior changes run `pnpm test` (seconds; filter with `pnpm test next mui`). `pnpm test:pack` is the release smoke test for the packed tarball.
- Dependency UI for the kit: `pnpm monitor` (Root update runs `pnpm up`).

## Do / don’t

| Do                                                                          | Don’t                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Register templates/recipes in `packages/ecosystem-typescript/src/registry/` | Add a template folder without registry entry               |
| Put cross-template recipe files in `shared/`                                | Put Next-only wiring in `shared/`                          |
| Add an overlay per supported family (`vite-react`, `next`, `nest`)          | Assume missing overlay is OK if `overlays/` exists         |
| Keep kit root `.agents/` (+ `.cursor` → `.agents`) for zealakit maintainers | Put kit maintainer docs only under `templates/*`           |
| Put skills/rules under `.agents/`                                           | Put real files only under `.cursor/` (must stay a symlink) |
| Derive types from `constants.ts`                                            | Hardcode scope/category lists in monitor or prompts        |
| Express compatibility via `scope` / `framework` / overlays (`compat.ts`)    | Special-case recipe or template ids in prompts/validation  |
| Keep core free of ecosystem imports                                         | Import `@zealakit/ecosystem-*` from core                   |

## Extending the kit

Detailed checklists: [extending.md](extending.md).

## Related

- Root agent entry: [AGENTS.md](../../../AGENTS.md)
- Rule: [.agents/rules/zealakit.mdc](../../rules/zealakit.mdc)
