---
name: project-structure
description: >-
  Opinionated SvelteKit layout and naming for this SPA. Use when adding routes,
  feature modules, layouts, shared UI, stores, or asking “where does this
  belong?”. Does not prescribe a UI kit, HTTP client, or validation library —
  those come from recipes.
---

# Project structure (SvelteKit)

SvelteKit uses **file-based routing** under `src/routes/`. Keep route files
thin: they only wire a path to a screen from `src/features/`.

**Naming hard rule:** all source **file and folder** names use **kebab-case**
(including `.svelte`). Component **identifiers** use **PascalCase** when
imported. Never `ProductCard.svelte` — use `product-card.svelte` and
`import ProductCard from "./product-card.svelte"`.

Path aliases: `@/*` → `src/*`, `$lib/*` → `src/lib/*` (SvelteKit built-in).

## When to apply

- Adding a route or screen
- Placing a component, composable, store, or API module
- Naming files and folders

Do **not** use this skill to choose a UI kit, HTTP client, or state library.

---

## Root

```
project/
├── static/                 # Static files copied as-is
├── src/                    # All application source
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## `src/` tree

```
src/
├── app.html                # SvelteKit HTML shell
├── app.d.ts                # App namespace + shared ambient types
├── routes/                 # File-based routing ONLY
│   ├── +layout.svelte      # Root: global CSS, providers
│   ├── +layout.ts          # SPA/SSR/prerender options
│   ├── (app)/              # Route group: authenticated console
│   │   ├── +layout.svelte  # Wires ConsoleLayout
│   │   ├── +page.svelte    # Overview screen
│   │   └── feature-a/
│   │       ├── +page.svelte
│   │       └── [id]/+page.svelte
│   └── (auth)/             # Route group: public entry
│       ├── +layout.svelte  # Wires EntryLayout
│       └── login/+page.svelte
├── features/               # Business features (screens + logic)
│   └── <feature>/
│       ├── list.svelte
│       ├── detail.svelte
│       ├── components/
│       ├── composables/    # *.svelte.ts when using runes
│       └── types/
├── layouts/                # App chrome shared by many routes
│   ├── console-layout/index.svelte
│   └── entry-layout/index.svelte
├── components/             # App-wide shared UI
│   └── feature-shell/index.svelte
├── lib/                    # Non-UI kernel ($lib)
│   ├── apis/               # Remote API functions + models
│   ├── constants/          # ROUTES, APIS, LOCALES, STORAGE
│   └── utils/              # Pure helpers
├── composables/            # Cross-feature runes (*.svelte.ts)
├── stores/                 # Client/session UI state
├── configs/                # Route map, env, bootstrap
├── assets/locales/<lang>/  # Translation namespaces
└── styles/                 # Global styles / tokens
```

---

## Routes are thin

`src/routes/` may contain only SvelteKit route files (`+page`, `+layout`,
`+server`, `+page.ts`, …). A route file imports one screen and renders it.

```svelte
<!-- src/routes/(app)/feature-a/+page.svelte -->
<script lang="ts">
  import FeatureAList from "@/features/feature-a/list.svelte";
</script>

<FeatureAList />
```

- No feature UI or business logic in `routes/`.
- Route paths come from `src/configs/routes.ts`, which composes
  `CONSTANTS.ROUTES` from `src/lib/constants/`.
- Use `goto()` from `$app/navigation` and `page` from `$app/state`.
- Route groups `(app)` / `(auth)` do not affect the URL.

## Features

```
features/<feature>/
├── list.svelte
├── detail.svelte
├── components/
│   └── <widget>/index.svelte
├── composables/
│   └── use-<feature>-<thing>.svelte.ts
└── types/index.ts
```

- One feature must not import another feature's internals. Share through
  `components/`, `lib/`, or `stores/`.
- Feature screens are default-exported Svelte components (implicit default
  export from `.svelte`).

## Layouts and shells

- `layouts/<name>-layout/index.svelte` = app chrome around multiple routes.
  Layouts receive `children` and render `{@render children()}`. No data fetching,
  form submit, or business logic.
- `components/feature-shell/` is optional shared list/detail chrome. Feature
  screens wrap their content with it; create one only when multiple features
  genuinely share the chrome.

## State and logic

| Need | Location |
| --- | --- |
| Cross-feature runes / logic | `src/composables/*.svelte.ts` |
| Global UI/session state | `src/stores/*.svelte.ts` |
| Feature-only logic | `src/features/<feature>/composables/` |
| API calls | `src/lib/apis/` + `CONSTANTS.APIS` |
| Pure helpers | `src/lib/utils/` |

Svelte 5 runes belong in `.svelte.ts` files when shared outside a component.

## Placement decision tree

1. Does it map to a URL? → thin file in `src/routes/`, screen in `features/`.
2. Used by one feature only? → `features/<feature>/components/`.
3. Wraps many routes (sidebar/header)? → `layouts/<name>-layout/`.
4. Shared shell for list/detail? → `components/feature-shell/` (optional).
5. Reused across the app? → `components/<shared-widget>/`.
6. UI primitive? → `components/ui/`.
7. API/config/pure logic? → `lib/`.
8. Global UI state/session? → `stores/`.
9. Translation copy? → `assets/locales/`.

## Anti-patterns

- Putting a full screen in `routes/.../+page.svelte`
- PascalCase source filenames (`ProductCard.svelte`)
- Fetching with literal URLs instead of `lib/apis` + `CONSTANTS.APIS`
- Importing one feature's internals from another feature
- Defining payloads with `interface` instead of `type`
- Fetching/submitting forms inside `layouts/`
