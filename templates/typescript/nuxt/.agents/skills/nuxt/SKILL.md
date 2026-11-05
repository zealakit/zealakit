---
name: nuxt
description: >-
  Nuxt app conventions, auto-imports, layouts, pages, and server routes.
  Use when adding pages, layouts, composables, server/api handlers, or Nuxt
  config. Prefer official Nuxt docs over older Nuxt 2/3 patterns.
---

# Nuxt

Ground truth: [Directory structure](https://nuxt.com/docs/4.x/directory-structure), [Guide](https://nuxt.com/docs/4.x/guide), [API](https://nuxt.com/docs/4.x/api).

## Hard rules

- Vue app code under **`app/`** (`pages/`, `layouts/`, `components/`, `composables/`, `assets/`, plus recipe `lib/` / `stores/` / `components/ui/`)
- Server handlers under **`server/`** (`api/`, `routes/`, …)
- Prefer Nuxt auto-imports (`useRoute`, components, composables) — do not re-import Vue Router APIs unless needed
- Pick layout with `definePageMeta({ layout: "…" })`
- Aliases `@/` and `~/` both mean **`app/*`** (default `srcDir`). Do not introduce a parallel top-level `src/`

## Layouts in this template

| Layout | Role |
| --- | --- |
| `default` | Public site chrome |
| `entry` | Auth entry (login / sign-up / forgot password) |
| `console` | Authenticated console chrome |

## Features

- `feature-a` — list + detail pages with optional `<FeatureAShell>`
- `feature-b` — same routes **without** shell (when UI diverges)

## i18n

Official module: [`@nuxtjs/i18n`](https://i18n.nuxtjs.org/) (Vue I18n). Configured in `nuxt.config.ts` (`modules` + `i18n`).

- Locale messages: `i18n/locales/<lang>.ts` (lazy loaders) + `i18n/locales/<lang>/*.json` namespaces (`common`, `action`, `field`, `message`)
- Keys: `$t('common.TEST')` / `t('action.CREATE.LABEL')` via `useI18n()`
- Links: always use `useLocalePath()` / `$localePath` (and `useSwitchLocalePath` for language switch) — never hardcode `/vi/...`
- Strategy: `prefix_except_default` (`en` at `/`, `vi` at `/vi/...`). Nitro `server/api/*` stays unprefixed

## Server

Example: `server/api/health.get.ts` → `GET /api/health` (not under a locale prefix).
