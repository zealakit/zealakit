---
name: project-structure
description: >-
  Defines Astro pages/layouts (base/site/entry/console), i18n locales, React
  islands, components/ui, and the hybrid server kernel for this astro-react-hybrid template.
  Use when adding pages, placing components, choosing layouts or hydration,
  wiring APIs, or answering “where does this belong?”.
---

# Project structure

Astro owns routing and page composition. React is used only for interactive islands. Recipes add libraries into the same folder roles.

**Naming hard rule:** all source **file and folder** names use **kebab-case**. React / Astro component **identifiers** use **PascalCase**. Never put a component as a lone file under `components/` — use a folder with `index.tsx` / `index.astro`. Layouts follow the same rule: `layouts/<name>-layout/index.astro`.

Path alias: `@/*` → `src/*`.

## When to apply

- “Where should I put X?”
- New page / layout / island / API module / locale copy
- Choosing which layout shell (site / entry / console)
- Choosing hydration directives

Do **not** use this skill to choose a UI kit. Recipes may add libraries into the same folders.

---

## Root

```
project/
├── public/
├── src/
├── astro.config.mjs
├── package.json
└── <tooling configs>
```

---

## `src/` tree

```
src/
├── pages/
│   ├── index.astro              # Redirects `/` → `/[defaultLocale]/`
│   ├── 404.astro                # Shared not-found (SSR rewrites)
│   ├── api/health.ts            # On-demand API endpoint
│   ├── en/ | vi/                # Match i18n.locales
│   │   ├── index.astro          # SiteLayout + server:defer island
│   │   ├── about.astro          # SiteLayout
│   │   ├── articles/[slug].astro # Article SSR (content collection and/or CMS)
│   │   ├── auth/login.astro     # EntryLayout
│   │   └── console/index.astro  # ConsoleLayout
├── middleware.ts                # requestId + session
├── actions/index.ts             # Astro Actions (defineAction)
├── content/
│   ├── landing/*.md             # Marketing / landing Markdown
│   └── articles/*.md            # Optional static articles (micro / few posts)
├── content.config.ts            # `landing` + `articles` collections
├── lib/
│   └── articles/                # `loadArticle` — CMS when `CMS_API_URL`, else content
├── layouts/
│   ├── base-layout/index.astro     # Document shell + SEO head (canonical, OG, JSON-LD)
│   ├── site-layout/index.astro     # Public / marketing chrome
│   ├── entry-layout/index.astro    # Auth / onboarding chrome
│   └── console-layout/index.astro  # Signed-in product chrome
├── components/                  # Folder per component + index.*
│   ├── counter/index.tsx
│   ├── user-profile-island/index.astro  # Server Island (server:defer)
│   ├── locale-switcher/index.astro
│   ├── site-header/index.astro
│   └── ui/
├── i18n/
│   ├── config.ts
│   ├── translations.ts
│   └── locales/<locale>/*.json
├── lib/ | hooks/ | configs/ | styles/
```

---

## Layouts (like Next route groups / Nuxt layouts)

| Layout | Role | Typical pages |
| --- | --- | --- |
| `base-layout` | `<html>` / `<head>` / `<body>` only | Composed by other layouts — do not use on pages directly unless you need a bare document |
| `site-layout` | Public marketing chrome (`SiteHeader`) | `/`, `/about`, landing |
| `entry-layout` | Unauthenticated entry | `/auth/login`, sign-up, forgot-password |
| `console-layout` | Signed-in product frame | `/console`, settings, CRUD |

**Rules**

- One kebab-case folder per layout; public entry is `index.astro`.
- Area layouts (`site` / `entry` / `console`) wrap `base-layout` and expose a `<slot />`.
- Pick the layout **in the page** via import (Astro has no `definePageMeta` like Nuxt).
- Layouts may wrap chrome + `<slot />` only — no API calls or feature submit logic.
- Do not put marketing nav on entry/console pages (use the matching layout).

```astro
---
import SiteLayout from "@/layouts/site-layout/index.astro";
---
<SiteLayout locale="en" title="…">
  <!-- page body -->
</SiteLayout>
```

---

## Component folders

| Kind | Entry | Import |
| --- | --- | --- |
| React island | `index.tsx` | `@/components/counter/index` |
| Astro component | `index.astro` | `@/components/site-header/index.astro` |

Split helpers in the same folder as the component grows. `components/ui/` stays one file per primitive + barrel (UI recipes).

---

## Placement rules

1. **Public page?** → `pages/<locale>/…` + `SiteLayout`
2. **Auth / onboarding?** → `pages/<locale>/auth/…` + `EntryLayout`
3. **Signed-in product UI?** → `pages/<locale>/console/…` + `ConsoleLayout`
4. **Interactive island?** → `components/<name>/index.tsx` + `client:*`
5. **Translated copy?** → `i18n/locales/<locale>/` + `getTranslations`
6. **Locale links?** → `getRelativeLocaleUrl` from `astro:i18n`
7. **Remote call?** → `lib/apis/`
8. **Landing Markdown?** → `content/landing/` + `astro:content`
9. **Articles?** → `lib/articles/loadArticle` (CMS if `CMS_API_URL`; else `content/articles/` for micro/static). Same route either way.
10. **UI primitive?** → `components/ui/` when a UI recipe is installed

---

## Checklist

- [ ] Page uses the correct area layout (site / entry / console)
- [ ] Layouts and shared components are folders with `index.astro` / `index.tsx`
- [ ] Localized pages live under `pages/<locale>/`
- [ ] React islands use an intentional hydration directive
