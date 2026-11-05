---
name: project-structure
description: >-
  Defines Nuxt app/ layout, pages vs layouts, feature examples, and where
  recipe files live under app/. Use when adding pages, placing components,
  naming files, or answering “where does this belong?”.
---

# Project structure

Opinionated Nuxt layout with **site / entry / console** areas (like Next route groups) plus **feature-a / feature-b** examples.

**Naming hard rule:** custom source **file and folder** names use **kebab-case** (including `.vue`). Vue component **identifiers** use **PascalCase**. Keep Nuxt-reserved names (`app.vue`, `nuxt.config.ts`, `pages/`, `layouts/`, `server/api/*.get.ts`, …).

Aliases (Nuxt defaults — `srcDir` is `app/`):

- `~/` and `@/` → `app/*`

Do **not** add a top-level `src/` folder; it conflicts with Nuxt’s meaning of source dir.

## Root

```
project/
├── app/                 # Vue app + recipe kernel (official srcDir)
├── i18n/                # @nuxtjs/i18n (locales + optional i18n.config)
├── server/              # Nitro server (api, routes, …)
├── public/
├── nuxt.config.ts
└── package.json
```

## `i18n/`

| Path | Role |
| --- | --- |
| `i18n/locales/en.ts` / `vi.ts` | Lazy locale loaders (`defineI18nLocale`) nesting JSON namespaces |
| `i18n/locales/<lang>/*.json` | Namespaces: `common`, `action`, `field`, `message` |

Use `$t('common.…')` / `useI18n()`, and `useLocalePath()` for in-app links. See the `nuxt` skill.

## `app/` tree

```
app/
├── app.vue
├── assets/
│   └── css/main.css
├── layouts/
│   ├── default.vue      # site
│   ├── entry.vue        # auth entry
│   └── console.vue      # authenticated console
├── pages/
│   ├── index.vue
│   ├── about-us.vue
│   ├── auth/login.vue | sign-up.vue | forgot-password.vue
│   ├── console/index.vue
│   ├── feature-a/index.vue | [id].vue
│   └── feature-b/index.vue | [id].vue
├── components/
│   ├── feature-a/shell.vue   # optional shared chrome → <FeatureAShell>
│   └── ui/                   # UI kit primitives (recipes)
├── composables/
│   └── use-feature-label.ts
├── lib/                      # apis / constants / utils / schemas (recipes)
└── stores/                   # Pinia / state (recipes)
```

## Placement

| Need | Put it |
| --- | --- |
| New URL / screen | `app/pages/…` + `definePageMeta({ layout })` |
| App chrome for many pages | `app/layouts/<name>.vue` |
| Auto-imported UI widget | `app/components/…` |
| Shared logic | `app/composables/use-*.ts` |
| Copy / locale JSON | `i18n/locales/<lang>/` (same keys in every language) |
| HTTP API | `server/api/…` |
| Constants / apis / utils from recipes | `app/lib/…` (`@/lib/…` or `~/lib/…`) |
| Pinia / stores from recipes | `app/stores/…` |
| UI kit primitives from recipes | `app/components/ui/…` |

## Anti-patterns

| Don’t | Do |
| --- | --- |
| Add top-level `src/` | Keep everything under `app/` + `server/` + `i18n/` |
| Invent `src/pages/` | Use `app/pages/` |
| Put copy under `app/assets/locales/` | Use `i18n/locales/` with `@nuxtjs/i18n` |
| Hardcode `/vi/...` in `NuxtLink` | `useLocalePath()` / `$localePath` |
| PascalCase filenames | kebab-case files |
| Force a feature shell when UIs diverge | Plain pages like `feature-b` |
| Import recipe UI via deep vendor paths | `@/components/ui/button` (or Nuxt auto-import) |
