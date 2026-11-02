---
name: project-structure
description: >-
  Defines Next.js App Router folder layout, [locale] routing, server/client
  component export rules, shared chrome, the client kernel (layouts, lib,
  hooks, configs), handlers, and naming for this next template. Use when
  adding pages, placing components, choosing server.tsx vs client.tsx,
  wiring APIs or i18n, or answering “where does this belong?”.
---

# Project structure

Opinionated App Router layout for a multilingual Next.js app. Page widgets live in route groups. `src/components/` holds optional shared feature chrome (`feature-shell`, only when list/detail UI is truly shared) and design-system primitives (`ui`).

**Naming hard rule:** all source **file and folder** names use **kebab-case** (including `.tsx`). React component **identifiers** use **PascalCase**. Never `HeroBanner.tsx` — use `hero-banner/` exporting `HeroBanner`.

Path alias: `@/*` → `src/*`.

## When to apply

- “Where should I put X?”
- New page / route group / shared widget / API module
- Choosing SSR vs CSR export files
- Naming CSS modules and component folders
- App chrome, feature shells, constants, shared hooks, bootstrap config

Do **not** use this skill to choose a UI kit. Recipes may add libraries into the same folders.

This app is already structured. Do **not** reshape into `src/pages/` or a Pages Router tree.

---

## Root

```
project/
├── public/
├── src/
├── next.config.ts
├── package.json
└── <tooling configs>
```

---

## `src/` tree

```
src/
├── proxy.ts                      # next-intl middleware (locale prefix)
├── app/
│   ├── layout.tsx                # Root shell: fonts, globals.css, <html>/<body>
│   ├── globals.css
│   └── [locale]/
│       ├── layout.tsx            # Validate locale + NextIntlClientProvider
│       ├── _shared/              # Widgets reused across multiple routes / groups
│       ├── (site)/               # Public marketing / site route group
│       │   ├── layout.tsx        # Site chrome (header, nav)
│       │   ├── page.tsx          # Home (index)
│       │   ├── about-us/page.tsx
│       │   ├── _handlers/        # View models for this group (calls lib/apis)
│       │   └── _components/      # Only if layout.tsx and/or this group's index page.tsx use them
│       ├── (entry)/              # Optional — unauthenticated entry flows
│       ├── (console)/            # Optional — authenticated app / dashboard
│       └── (landing)/            # Optional — campaign / one-off landing pages
├── layouts/                      # App chrome shells (from client-shared-pieces recipe)
│   ├── console-layout/           # Authenticated app frame (sidebar, header, footer, …)
│   └── entry-layout/             # Unauthenticated entry (login, sign-up, forgot password, …)
├── components/
│   └── feature-shell/            # Optional shared list/detail chrome (add only when reused)
├── lib/                          # Non-UI kernel (from client-shared-pieces recipe)
│   ├── apis/                     # Remote API functions + models
│   ├── constants/                # Routes, endpoints, storage keys
│   └── utils/                    # Pure helpers
├── hooks/                        # Rare shared hooks only (from client-shared-pieces recipe)
├── configs/                      # App bootstrap (theme, env flags)
└── i18n/
    ├── request.ts
    ├── routing.ts
    ├── navigation.ts
    ├── messages.ts
    ├── get-translation.ts        # Server helper
    ├── use-translations.ts       # Client helper
    └── locales/<lang>/*.json
```

Folders added by recipes (same **role**, library may vary):

| Folder | Role | Example libraries |
| --- | --- | --- |
| `src/components/ui/` | Design-system primitive wrappers | Ant Design, MUI, shadcn/ui, … |

---

## Route groups vs shared

| Location | Role |
| --- | --- |
| `app/[locale]/(site)/` | Default public area: pages + optional `_components` / `_handlers` |
| `app/[locale]/(<group>)/_components/<name>/` | Widgets imported by that group’s **`layout.tsx`** and/or the group’s **index** `page.tsx` only |
| `app/[locale]/(<group>)/<route>/_components/<name>/` | Widgets used by **that route alone** (e.g. `(landing)/black-friday/_components/…`) |
| `app/[locale]/_shared/<name>/` | Widgets reused across **multiple routes and/or groups**; often needs both SSR and CSR exports |
| `app/[locale]/layout.tsx` | Locale boundary + i18n provider only |
| `app/layout.tsx` | Global Next shell (`html` / `body` / fonts / CSS) |

Route group folders `(…)` do **not** appear in the URL. Each group may have its own `layout.tsx` and `_handlers/`. Add a group-level `_components/` **only** when the group layout or index page actually imports widgets from it.

### `_components` placement (hard rules)

Inside a route group `(<group-name>)`:

1. **Group-level `_components/`** — only when that group’s `layout.tsx` uses the widgets, **or** they belong to the group’s **index** `page.tsx` (no nested segment folder for that page). If the layout does not import any group widgets and the index page has none, **do not** create `(group)/_components/`.
2. **Route-level `_components/`** — when a widget is used only by one nested route, put it under that route: `(group)/<route>/_components/<widget>/`. Example: flash-sale UI only on Black Friday → `(landing)/black-friday/_components/flash-sale-counter/`, **not** `(landing)/_components/…`.
3. **`[locale]/_shared/`** — when the same widget is used in **more than one** place (multiple routes in the group, or across groups). Do **not** park single-route widgets in `_shared/` “just in case”, and do **not** use group-level `_components/` as a dumping ground for every child route.

```
# ✅ widget only for /black-friday
(landing)/
├── layout.tsx                      # sparse/custom; no _components unless layout imports widgets
└── black-friday/
    ├── page.tsx
    └── _components/
        └── flash-sale-counter/

# ❌ group-level _components owned by a single child route
(landing)/
├── _components/
│   └── flash-sale-counter/         # wrong — only black-friday uses it
└── black-friday/
    └── page.tsx

# ✅ reused by black-friday + another campaign (or another group)
[locale]/
└── _shared/
    └── flash-sale-counter/
```

### Optional route groups

`(site)` is the default. The groups below are **optional** — keep or grow them only when the product needs that surface. Stubs in the template are starting points, not required features.

| Group | Use when | Typical routes | Layout chrome |
| --- | --- | --- | --- |
| `(site)` | Always (default) | `/`, `/about-us`, … | Public header / footer in `(site)/layout.tsx` |
| `(entry)` | Auth / onboarding before the app | `/auth/login`, `/auth/sign-up`, forgot-password, … | `(entry)/layout.tsx` renders `src/layouts/entry-layout` |
| `(console)` | Signed-in product UI | `/console`, settings, resource CRUD, … | `(console)/layout.tsx` renders `src/layouts/console-layout` |
| `(landing)` | Campaign or one-off pages that should **not** inherit `(site)` chrome | `/campaign-example`, promo slugs, … | Sparse or custom layout in the group (or none) |

**Rules for optional groups**

- Create `(entry)` / `(console)` / `(landing)` only when you need a **different layout boundary** from `(site)`.
- Do not put login screens under `(site)` if they need a different chrome — use `(entry)`.
- Do not put dashboard screens under `(site)` — use `(console)`.
- Do not force campaign pages through the marketing header — use `(landing)`.
- `(entry)/layout.tsx` and `(console)/layout.tsx` are the App Router boundaries. Visual chrome (sidebar, header, logo) lives in `src/layouts/` and is rendered from those files.
- `(site)` and `(landing)` chrome stays in that group’s `layout.tsx`. Do not fold marketing or campaign shells into `src/layouts/`.
- Cross-route / cross-group widgets (e.g. locale switcher) stay in `[locale]/_shared/`.
- Delete unused optional groups rather than leaving empty placeholders in a real app.

Example shapes (optional):

```
(entry)/
├── layout.tsx                 # Renders EntryLayout from @/layouts/entry-layout
└── auth/
    ├── login/page.tsx
    └── sign-up/page.tsx

(console)/
├── layout.tsx                 # Renders ConsoleLayout from @/layouts/console-layout
└── console/page.tsx

(landing)/
├── layout.tsx                 # Optional; add _components/ here only if this layout uses widgets
└── campaign-example/
    ├── page.tsx
    └── _components/           # Only if these widgets are campaign-example–local
        └── hero/
```

---

## Shared folders

These sit beside `app/` and `i18n/`. Route groups own pages and their widgets. The folders below own entry/console chrome, the non-UI kernel, and bootstrap.

### `src/layouts/`

App-level chrome for `(entry)` and `(console)` — **not** page screens and **not** CRUD forms.

```
layouts/
├── console-layout/          # Logged-in frame: sidebar, header, footer, …
│   └── index.tsx
└── entry-layout/            # Public auth entry: login, sign-up, forgot password, …
    └── index.tsx
```

| Layout | Composed by | Role |
| --- | --- | --- |
| `console-layout` | `app/[locale]/(console)/layout.tsx` | Shell around authenticated console routes |
| `entry-layout` | `app/[locale]/(entry)/layout.tsx` | Shell around unauthenticated entry routes |

**Rules**

- One kebab-case folder per layout; export the layout component from `index.tsx`.
- `(entry)/layout.tsx` and `(console)/layout.tsx` are the App Router boundaries (`children`). Their visual frames live in `src/layouts/entry-layout` and `src/layouts/console-layout`.
- `(site)` and `(landing)` keep their chrome in that group’s `layout.tsx`.
- Layouts may wrap `children` and shared chrome only.
- No API calls, no form submit logic, no feature-specific copy beyond chrome labels.
- Optional list/detail/create chrome may live in `components/feature-shell/` — do not fold that into `layouts/`. Skip `feature-shell` when console pages do not share chrome.

### `src/components/feature-shell/` (**optional**)

Shared composite for list/detail/create/update chrome: capabilities, overlay vs route presentation, busy state.

**Not required** and **not shipped** in this template by default. Add it only when several console screens truly share that chrome. If each page’s UI differs, build route-local widgets under `_components/` instead of forcing a shell.

When used, console pages wrap list/detail/create/update content with this chrome and read its context from the hook.

If a widget is only used by one **nested route** → that route’s `_components/`. If only the group layout / index page uses it → that group’s `_components/`. If multiple routes/groups use it → `[locale]/_shared/`.

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
| `apis/models/` | Request/response types (`*.model.ts`) |
| `constants/` | `ROUTES`, `APIS`, `STORAGE` — path and endpoint strings. Locale codes stay in `src/i18n/` |
| `utils/` | Pure helpers |

Route-group `_handlers/` map API results into view models. They call `lib/apis`; they do not replace it.

### `src/hooks/`

Cross-route hooks only (e.g. `use-mobile-view.ts`). Hooks used by one widget stay next to that widget.

### `src/configs/`

Bootstrap configuration modules (theme, env-derived flags). Not a business feature and not copy.

---

## Component folder contract

Each widget folder under `_components/` or `_shared/`:

```
<widget-name>/
├── template.tsx                         # Presentational view (no "use client" unless the view itself needs it)
├── server.tsx                           # Optional SSR export entry
├── client.tsx                           # Optional CSR export entry
├── skeleton.tsx                         # Loading UI
└── <page-or-scope>-<widget-name>.module.css   # Optional scoped CSS
```

### Hard rules

1. **`server.tsx` and `client.tsx` are export entries only.**
   - Pages / layouts import from `./server` or `./client`.
   - Files **inside the same folder must not import both** `server.tsx` and `client.tsx`.
2. **`template.tsx` owns the view.**
   - SSR / SEO path: `server.tsx` imports `template.tsx` and prepares data.
   - CSR / lighter server path: `client.tsx` imports `template.tsx` (and may fetch on the client).
3. **Usually create only one of `server.tsx` or `client.tsx`.**
   - SEO-critical / first-paint content → `server.tsx`
   - Deferred / interactive / secondary blocks → `client.tsx`
4. **Use `_shared/` when the same widget is reused in multiple places and some call sites need SSR while others need CSR.**
   - Then provide **both** `server.tsx` and `client.tsx`.
   - Still: never import both from a sibling file; call sites choose one entry.
5. **`skeleton.tsx`** is the loading fallback (often with `Suspense`).
6. **CSS module name:** `<page>-<component-name>.module.css` for page/group widgets (e.g. `home-hero-banner.module.css`), or `shared-<component-name>.module.css` for `_shared/`.
   - Skip the CSS file when styling comes from a library (MUI, Tailwind, …).

### Examples in this template

| Widget | Mode | Why / placement |
| --- | --- | --- |
| `(site)/_components/hero-banner` | `server.tsx` only | Homepage index `page.tsx` only (group index → group `_components`) |
| `(site)/_components/solutions` | `client.tsx` only | Homepage index only; deferred section |
| `[locale]/_shared/locale-switcher` | both exports | Used from `(site)` layout (and reusable elsewhere) → `_shared` |

Import examples:

```ts
import { HeroBanner } from "./_components/hero-banner/server";
import { Solutions } from "./_components/solutions/client";
import { LocaleSwitcher } from "../_shared/locale-switcher/server";
// import { LocaleSwitcher } from "../_shared/locale-switcher/client";
```

---

## `_handlers/`

Route-group view models for pages and server components. Remote calls stay in `lib/apis`.

```
(site)/_handlers/index.ts
```

- Map `lib/apis` results into the shape the page needs — not inside `template.tsx`.
- Do not open a second HTTP client here.
- Server components may `await` handlers directly.
- Client components may call handler functions only if they are browser-safe (no `server-only` secrets). Prefer a client handler when the mapping diverges.

---

## i18n

| File | Role |
| --- | --- |
| `i18n/routing.ts` | Locales + default locale |
| `i18n/navigation.ts` | Locale-aware `Link`, `useRouter`, … |
| `i18n/request.ts` | Load messages for the active locale |
| `i18n/get-translation.ts` | Server: `await getTranslation(["common", "action"])` |
| `i18n/use-translations.ts` | Client: `useTranslations(["common"])` |
| `i18n/locales/<lang>/*.json` | Namespaces: `common`, `action`, `field`, `message` |

Keys use `namespace:PATH.TO.KEY` (e.g. `common:SITE.NAV.HOME`). Add every new key to **all** languages.

---

## Naming conventions

| What | Case | Example |
| --- | --- | --- |
| Folders | `kebab-case` | `hero-banner/`, `feature-shell/`, `console-layout/` |
| Source files | `kebab-case` | `server.tsx`, `home-hero-banner.module.css` |
| Component / type identifiers | `PascalCase` | `HeroBanner`, `ConsoleLayout`, `EntryLayout` |
| Hooks / functions | `camelCase` | `useFeatureShell`; file `use-feature-shell.ts` |

**Never:** `PascalCase.tsx` filenames, importing both `server` and `client` from the same sibling module, putting page-only widgets in `_shared/` “just in case”.

---

## TypeScript

Prefer **functional** style and **`type` aliases**, not `interface`. Use `import type` for type-only imports.

---

## Placement decision tree

1. **URL / screen?** → `app/[locale]/<group>/<route>/page.tsx`
   - Public marketing → `(site)/`
   - Auth / onboarding → `(entry)/` *(optional)*
   - Signed-in app → `(console)/` *(optional)*
   - Campaign / one-off → `(landing)/` *(optional)*
2. **UI for one nested route only?** → `<group>/<route>/_components/<widget>/`
3. **UI for this group’s `layout.tsx` or index `page.tsx` only?** → `<group>/_components/<widget>/` (omit the folder if neither needs it)
4. **UI reused across multiple routes / groups?** → `[locale]/_shared/<widget>/`
5. **Entry or console chrome (sidebar / auth frame)?** → `layouts/<name>-layout/`, rendered from that group’s `layout.tsx`
6. **List/detail chrome truly shared across console pages?** → optional `components/feature-shell/`; otherwise route `_components/` only
7. **Primitive control?** → `components/ui/` (when a UI recipe is applied)
8. **SEO / first paint?** → export via `server.tsx`
9. **Deferred / interactive?** → export via `client.tsx`
10. **Loading state?** → `skeleton.tsx` + `Suspense`
11. **Remote endpoint function?** → `lib/apis/`
12. **Path or endpoint string?** → `lib/constants/` (`ROUTES`, `APIS`, `STORAGE`)
13. **View model for one route group?** → `<group>/_handlers/` (calls `lib/apis`)
14. **Pure helper?** → `lib/utils/`
15. **Cross-route hook?** → `hooks/`
16. **Theme or env bootstrap?** → `configs/`
17. **Locale code or copy?** → `src/i18n/`

---

## New page checklist

```
[ ] Add app/[locale]/<group>/<route>/page.tsx
[ ] Register nav Link via @/i18n/navigation; href from CONSTANTS.ROUTES (no locale prefix)
[ ] Add locale keys in every language under src/i18n/locales/
[ ] Put widgets under <route>/_components/ (one route), <group>/_components/ (layout/index only), or _shared/ (multi-route)
[ ] Choose server.tsx OR client.tsx (both only for _shared dual use)
[ ] Add skeleton.tsx when the section suspends or loads async
[ ] Name CSS <page>-<component>.module.css when using CSS modules
[ ] Keep template.tsx free of export-entry imports
[ ] (entry)/(console) only: compose the group layout from src/layouts/
[ ] Remote calls in lib/apis; that group's view models in _handlers/
```

---

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| Import `./server` from `./client` (or vice versa) | Call sites import one entry; both wrap `template.tsx` |
| Put `"use client"` on `template.tsx` by default | Keep template presentational; client entry owns interactivity |
| Dump all widgets in `_shared/` | `_shared/` only for true multi-route / multi-group reuse |
| Group-level `_components/` for a single child route (e.g. only `black-friday`) | `<route>/_components/` under that route |
| Empty `(group)/_components/` when layout/index never import it | Omit the folder until something needs it |
| `HeroBanner.tsx` PascalCase file | `hero-banner/server.tsx` exporting `HeroBanner` |
| Magic `/en/...` or raw paths in JSX | `Link` / `redirect` from `@/i18n/navigation`, href from `CONSTANTS.ROUTES` |
| Fetch inside `template.tsx` or a second HTTP client in `_handlers/` | `lib/apis` for the call; `_handlers/` for the view model |
| Inline endpoint strings | `CONSTANTS.APIS` in `lib/constants` |
| Sidebar markup only inside `(console)/layout.tsx` | Compose `src/layouts/console-layout` from that layout |
| Marketing header inside `src/layouts/` | Keep `(site)` chrome in `(site)/layout.tsx` |
| API calls inside `components/ui` or a page template | `lib/apis` from `_handlers/` |
| Import the vendor UI package from a page | `@/components/ui` when a UI recipe is applied |
| Business logic / CRUD in `layouts/` | Page handlers and screens; shared CRUD chrome → optional `feature-shell` |
| Force `feature-shell` when page UIs diverge | Route-local `_components/` without a shared shell |
| Layouts under `components/layouts/` | Top-level `src/layouts/<name>-layout/` |
| Login under `(site)` with marketing chrome | `(entry)/auth/...` composing `entry-layout` |
| Dashboard under `(site)` | `(console)/...` with app chrome |
| Campaign page forced through site header | `(landing)/...` with sparse/custom layout |
| Keep empty optional groups forever | Delete unused `(entry)` / `(console)` / `(landing)` stubs |
| `html`/`body` in `[locale]/layout.tsx` when root layout exists | Root `app/layout.tsx` owns the document shell |
| `NextIntlClientProvider` in root layout | Keep provider in `app/[locale]/layout.tsx` |

---

## Related

- UI generation / refactor / performance → [.agents/skills/reactjs/SKILL.md](../reactjs/SKILL.md)
- Forms → a form recipe may add a skill under `.agents/skills/`
