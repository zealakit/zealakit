---
name: project-structure
description: >-
  Defines folder layout, file naming, routing, optional feature-shell chrome,
  and form placement for this SPA. Use when adding features, placing files,
  naming routes/hooks/components, wiring APIs, building forms/schemas, or
  answering “where does this belong?”. Does not prescribe a UI kit, HTTP client,
  or state library — those come from recipes.
---

# Project structure

Opinionated layout for a multi-feature SPA. Prefer **feature modules** over dumping everything into `components/`.

**Naming hard rule:** all source **file and folder** names use **kebab-case** (including `.tsx`). React component **identifiers** use **PascalCase**. Never `ProductCard.tsx` — use `product-card.tsx` (or `product-card/index.tsx`) exporting `ProductCard`.

Path alias: `@/*` → `src/*`.

## When to apply

- “Where should I put X?”
- New feature / route / shared UI / API module
- Naming folders and files
- Creating form schemas, feature form hooks, or validation messages

Do **not** use this skill to choose a UI kit, HTTP client, or global state library. Only place, name, and wire artifacts. Recipes may add different libraries into the same folders.

This app is already structured. Do **not** reshape into `src/pages/` or a CRA-style tree.

---

## Root

```
project/
├── public/                 # Static files copied as-is
├── src/                    # All application source
├── index.html              # HTML shell
├── package.json
└── <tooling configs>       # Build, TS, lint — not app domain
```

---

## `src/` tree

```
src/
├── main.tsx                 # Bootstrap: mount app, load global CSS + config modules
├── general.d.ts             # Ambient / shared types
├── app/
│   ├── index.tsx            # Thin app shell: loading fallback + router provider
│   ├── router/              # Route tree composition (lazy segments)
│   └── features/            # One folder per business feature
├── layouts/                 # App chrome shells (from client-shared-pieces recipe)
│   ├── console-layout/      # Authenticated app frame (sidebar, header, footer, …)
│   └── entry-layout/        # Unauthenticated entry (login, sign-up, forgot password, …)
├── components/
│   └── feature-shell/       # Optional shared list/detail chrome (see below)
├── lib/                     # Non-UI kernel (from client-shared-pieces recipe)
│   ├── apis/                # Remote API functions + models
│   ├── constants/           # Routes, endpoints, locale codes, storage keys
│   └── utils/               # Pure helpers
├── hooks/                   # Rare shared hooks only (from client-shared-pieces recipe)
├── configs/                 # App bootstrap (i18n from client-shared-pieces vite-react overlay)
├── assets/
│   └── locales/<lang>/      # Copy namespaces (same filenames per language)
└── styles/                  # Global styles / tokens
```

Folders added by recipes (same **role**, library may vary):

| Folder | Role | Example libraries |
| --- | --- | --- |
| `src/hooks/`, `src/layouts/`, `src/lib/` | Shared client kernel (default recipe `shared/`) | — |
| `src/configs/i18n.ts` | Client bootstrap (default recipe `overlays/vite-react`) | — |
| `src/stores/` | Client / session UI state (not server cache) | Zustand, Nanostores, … |
| `src/lib/schemas/` | Validation schemas for forms / payloads | Zod, Valibot, … |
| `src/lib/fetcher/` | Shared HTTP client instance + interceptors | Ky, Axios, … |
| `src/components/ui/` | Design-system primitive wrappers | Ant Design, MUI, shadcn/ui, … |

Optional later (create when needed; do not invent a dump drawer): `queries/`.

---

## Folder roles

### `src/app/index.tsx` + `src/main.tsx`

| File | Role |
| --- | --- |
| `main.tsx` | Mount the root element, import global CSS and config modules (e.g. i18n), render the app. Keep side effects ordered and minimal. |
| `app/index.tsx` | Loading fallback + router provider. No screens inline. |

### `src/app/router/`

Assemble the route tree. Stay thin — **no feature UI here**.

| Unit | Role |
| --- | --- |
| `index.tsx` | Create the router, compose area arrays |
| `auth.tsx` / `overview.tsx` / `feature-a.tsx` / `feature-b.tsx` | Split route tables by area |

**Rules**

- Lazy-load feature screen modules.
- Register the screen as a route component field (e.g. React Router `Component`, not a JSX `element`) so `.ts`/`.tsx` both work.
- Paths come from `CONSTANTS.ROUTES` — no magic URL strings.

### `src/app/features/<feature>/`

Own one business domain.

```
features/<feature>/
├── shell.tsx                 # Layout + nested outlet + shared feature chrome
├── list.tsx                  # List screen
├── detail.tsx                # Detail screen
├── components/               # UI only this feature uses
│   └── <widget-name>/
│       └── index.tsx
├── hooks/
│   ├── use-<feature>-shell-context.ts
│   └── use-<kebab>.ts
└── types/                    # Feature-only types (optional)
```

Auth-style features skip shell and use one file per screen: `login.tsx`, `sign-up.tsx`, `forgot-password.tsx`.

| Unit | Role |
| --- | --- |
| `shell.tsx` | **Optional** feature boundary when using shared `FeatureShell` + nested `<Outlet />` |
| `list.tsx` / `detail.tsx` | One screen = one file at the feature root |
| `components/` | Feature-private UI; do not import from another feature’s `components/` |
| `hooks/` | Feature logic |

**Rule:** Feature A must not deep-import Feature B internals. Share via `components/`, `lib/`, or `stores/`.

Default-export the screen component; router files lazy-import that module.

**Examples in this template**

| Feature | Shell? | Role |
| --- | --- | --- |
| `feature-a/` | Yes — `shell.tsx` + `FeatureShell` | Reference when several screens share list/detail/create chrome |
| `feature-b/` | No — routes use `<Outlet />` only | Reference when UI is unique; skip shell rather than force a bad fit |

### `src/components/feature-shell/` (**optional**)

Shared composite for list/detail/create/update chrome: capabilities, overlay vs route presentation, busy state.

**Not required.** Use it only when multiple screens (or features) truly share that chrome. If layouts, interactions, or presentation differ, build plain feature screens like `feature-b/` — do not wrap everything in `FeatureShell` “for consistency”.

When you do use it:

- Add `features/<feature>/shell.tsx` that wraps `<FeatureShell>…<Outlet /></FeatureShell>`
- Screens read context via a feature hook alias (e.g. `useFeatureAShell`)
- If a widget is only used by one feature → keep it under that feature’s `components/`

### `src/layouts/`

App-level chrome used by the router — **not** feature screens and **not** CRUD forms.

```
layouts/
├── console-layout/          # Logged-in frame: sidebar, header, footer, …
│   └── index.tsx
└── entry-layout/            # Public auth entry: login, sign-up, forgot password, …
    └── index.tsx
```

| Layout | Role |
| --- | --- |
| `console-layout` | Shell around authenticated console routes |
| `entry-layout` | Shell around unauthenticated entry routes |

**Rules**

- One kebab-case folder per layout; export the layout component from `index.tsx`.
- Layouts may wrap an `<Outlet />` (or children) and shared chrome only.
- No API calls, no form submit logic, no feature-specific copy beyond chrome labels.
- Optional feature chrome (list/detail/create) stays in `components/feature-shell/` or `features/<feature>/shell.tsx` — do not fold that into `layouts/`.

### `src/components/ui/` (when a UI recipe is applied)

Design-system primitive wrappers (no API calls, no feature copy). One kebab-case file per primitive (`button.tsx`, …); re-export from `index.ts`. Import via `@/components/ui`, not the vendor package.

### `src/lib/`

Non-UI kernel. Import from concrete modules:

```ts
import { CONSTANTS } from "@/lib/constants";
import { apis } from "@/lib/apis";
```

| Subfolder | Role |
| --- | --- |
| `apis/` | Backend calls; one module per resource |
| `apis/index.ts` | Barrel of resource modules (`apis.example`, `apis.locale`, …) |
| `apis/models/` | Request/response types (`*.model.ts`). Shared envelope types live in `general.d.ts` |
| `constants/` | `ROUTES`, `APIS`, `LOCALES`, `STORAGE` — **no magic strings in UI** |
| `schemas/` | Validation schema factories (form recipe) |
| `utils/` | Pure helpers |
| `fetcher/` | Shared HTTP instance (HTTP-client recipe) |

### `src/stores/`

Client/session UI state only (not server cache). One concern per file: `auth.store.ts`. Present when a state recipe is applied.

### `src/hooks/`

Cross-feature hooks only (e.g. `use-mobile-view.ts`). Feature hooks stay in `features/<feature>/hooks/`.

### `src/configs/`

Bootstrap configuration modules (e.g. i18n init, env-derived flags). Not a business feature.

### `src/assets/locales/<lang>/`

Same filenames in **every** language folder:

| File | Role |
| --- | --- |
| `common.json` | Shared UI copy (generic nouns, layout labels) |
| `action.json` | Buttons / verbs |
| `field.json` | Form labels / placeholders |
| `message.json` | Success / error / confirm / info |

Add a new key to **every** language. Reference as `namespace:KEY.PATH` (e.g. `field:NAME.LABEL`, `message:ERROR.REQUIRED`). Prefer an existing namespace over a fifth file.

### `src/styles/`

Global stylesheets and token files. Component-scoped styles live next to the component when needed.

---

## Naming conventions

| What | Case | Example |
| --- | --- | --- |
| Folders | `kebab-case` | `feature-a/`, `feature-shell/`, `console-layout/` |
| Source files | `kebab-case` | `use-feature-a-shell-context.ts` |
| Component / type identifiers | `PascalCase` | `FeatureAShell`, `ConsoleLayout`, `ExampleModel` |
| Hooks / functions | `camelCase` | `useFeatureShell`; file `use-feature-shell.ts` |

**Exceptions:** dotfiles / tooling (`package.json`, lint configs, `tsconfig.json`, bundler config), `index.html`, `main.tsx`, locale `*.json` names.

| Artifact | Pattern | Example |
| --- | --- | --- |
| Feature screens | `<intent>.tsx` at feature root | `shell.tsx`, `list.tsx`, `login.tsx` |
| Router area | `app/router/<area>.tsx` | `feature-a.tsx`, `feature-b.tsx` |
| Component folder | `kebab-case/` + `index.tsx` | `some-comp/index.tsx` |
| App layout | `layouts/<name>-layout/` + `index.tsx` | `layouts/entry-layout/index.tsx` |
| API module | `kebab-case.ts` | `example.ts` |
| Models | `<name>.model.ts` | `example.model.ts` |
| Schemas | `<name>.schema.ts` | `example.schema.ts` |
| Stores | `<name>.store.ts` | `auth.store.ts` |
| Constants | grouped folders | `constants/routes/feature-a.ts` |

**Never:** `ProductCard.tsx`, `LoginPage.tsx`, `src/pages/`, `src/api/`, `src/utils/` as a primary root, `src/types/` as a junk drawer.

---

## TypeScript

Prefer **functional** style and **`type` aliases**, not `interface`.

```ts
type ExampleFormValues = {
  name: string;
  email: string;
};
```

Use `interface` only for declaration merging (ambient `.d.ts`). Prefer `import type` for type-only imports. Colocate feature types under `features/<feature>/types/` or next to the module; shared API shapes live in `lib/apis/models/`.

---

## Placement decision tree

1. **Tied to one URL / screen?** → `app/features/<feature>/<intent>.tsx`
2. **UI only that feature uses?** → `features/<feature>/components/`
3. **App chrome around many routes (sidebar / auth frame)?** → `layouts/<name>-layout/`
4. **List/detail chrome truly shared across screens/features?** → optional `components/feature-shell/` (+ `shell.tsx`). Otherwise plain screens like `feature-b/`
5. **Reusable composite?** → `components/<shared-widget>/`
6. **Primitive control?** → `components/ui/` (when present)
7. **API / path constant / schema / pure helper?** → `lib/`
8. **Session or UI global state?** → `stores/`
9. **Copy / static JSON?** → `assets/locales/`

---

## New feature checklist

```
[ ] Create src/app/features/<feature>/
[ ] Add list.tsx (and detail/create/update as needed)
[ ] Only if chrome is shared: add shell.tsx + FeatureShell (see feature-a); else skip (see feature-b)
[ ] Register lazy routes in app/router/<feature>.tsx using CONSTANTS.ROUTES
[ ] Compose the area into app/router/index.tsx
[ ] Add lib/constants/routes + lib/constants/apis as needed
[ ] Add lib/apis/<resource>.ts + models
[ ] Feature hooks under features/<feature>/hooks/
[ ] Feature components under features/<feature>/components/
[ ] Locale keys in every language under assets/locales/
[ ] No cross-feature component imports
[ ] kebab-case files; PascalCase component exports
```

Form validation: a form recipe may add a skill under `.agents/skills/`.

---

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| `src/pages/` + `LoginPage.tsx` | `app/features/auth/login.tsx` |
| `src/api/` / `src/utils/` as roots | `lib/apis/` / `lib/utils/` |
| Inline routes in a fat app entry | `app/router/` + thin `app/index.tsx` |
| Magic URL/API strings in JSX | `CONSTANTS.ROUTES` / `CONSTANTS.APIS` |
| Import another feature’s `components/` | Promote to `components/` or `lib/` |
| `PascalCase.tsx` filenames | `kebab-case.tsx` + PascalCase export |
| `interface` for props/models by default | `type` |
| Hardcoded validation strings in schemas | Schema factory with `t` (form recipe skill, when present) |
| API calls inside `components/ui` | `lib/apis` + feature/route |
| Business logic / CRUD in `layouts/` | Feature hooks / screens; shared CRUD chrome → optional `feature-shell` |
| Force `FeatureShell` when UI diverges | Plain screens (`feature-b`) without shell |
| Layouts under `components/layouts/` | Top-level `src/layouts/<name>-layout/` |
| Bind a folder to one library forever | Same folder, recipe picks the library |

---

## Related

- UI generation / refactor / performance → [.agents/skills/reactjs/SKILL.md](../reactjs/SKILL.md)
- Forms → a form recipe may add a skill under `.agents/skills/`
