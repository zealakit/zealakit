---
name: astro
description: >-
  Astro-first architecture for this template: static rendering, React islands,
  hydration directives, and server-first data fetching. Use when adding pages,
  layouts, interactive components, or deciding client vs static rendering.
---

# Astro + React islands

This skill is present because the project is the **astro-react-client** template.

## Critical rules

1. **Astro owns the app shell** — routing, layouts, and static composition use `.astro`.
2. **Zero JS by default** — do not hydrate components that do not need the browser.
3. **React is for islands** — interactive UI lives in `.tsx` and is imported into `.astro` with an explicit `client:*` directive.
4. **Pick hydration deliberately** — `client:load` is for above-the-fold interaction; prefer `client:visible` or `client:idle` when possible. Never blanket-hydrate the whole page.
5. **Server-first data** — fetch in Astro frontmatter (`---`) when the data can be resolved at build/request time. Keep secrets and private env vars out of client islands.
6. **Do not SPA-ify** — avoid client-side routers or a single React root that owns every page.
7. **i18n routing** — locales and `defaultLocale` live in `src/i18n/config.ts` and `astro.config.mjs`. Pages go under `src/pages/<locale>/`. Use `getRelativeLocaleUrl` for links; keep copy in `src/i18n/locales/` via `getTranslations`.
8. **Area layouts** — compose pages with `site-layout` (public), `entry-layout` (auth), or `console-layout` (signed-in). They wrap `base-layout` for the document shell.
9. **Selective SSR** — `@astrojs/node` is configured with `site` for absolute SEO URLs. Keep most routes static; opt into on-demand rendering with `export const prerender = false` (see `src/pages/<locale>/articles/[slug].astro`). Missing entries should `Astro.rewrite('/404')` after setting `Astro.response.status = 404`. Pass canonical / Open Graph / JSON-LD through `base-layout` props.
10. **Landing vs articles** — `src/content/landing/` for marketing pages. Articles use `loadArticle`: **CMS/API** when `CMS_API_URL` is set; otherwise **`src/content/articles/`** Markdown (fine for micro sites / few posts). Prefer CMS when editorial volume or non-dev authors grow.

## i18n routing (built-in)

Configured with `prefixDefaultLocale: true`. Root `src/pages/index.astro` redirects `/` → `/[defaultLocale]/`:

- `/` → `/en/`
- `/vi/…` for Vietnamese
- Folder names under `pages/` must match `locales` exactly

```astro
---
import { getRelativeLocaleUrl } from "astro:i18n";
import { getTranslations } from "@/i18n/translations";
const locale = "en";
const t = getTranslations(locale);
---
<a href={getRelativeLocaleUrl(locale, "about")}>{t.SITE.NAV.ABOUT}</a>
```

When adding a language: extend `locales` in `src/i18n/config.ts`, add `src/i18n/locales/<code>/`, and create matching `src/pages/<code>/` routes.

## Hydration cheat sheet

| Directive | Use when |
| --- | --- |
| (none) | Static / no interactivity |
| `client:load` | Needed immediately on page load |
| `client:idle` | Can wait until the main thread is idle |
| `client:visible` | Below the fold / only when scrolled into view |
| `client:only="react"` | Must skip SSR for this island |

## Example

```astro
---
import { Counter } from "@/components/counter/index";
---
<!-- Static Astro content -->
<p>Hello</p>
<!-- Interactive island -->
<Counter client:visible />
```

## Styling

Follow the installed styling solution (`src/styles/global.css` and any UI recipe). Do not add a second CSS framework without a clear need.

## UI kits (antd / MUI / shadcn)

Render kit components inside React islands. Wrap islands with the recipe theme provider when needed — **do not** put a `client:load` theme provider around the entire `Layout.astro` body (that would ship JS on every page).
