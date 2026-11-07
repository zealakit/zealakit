---
name: nuxt-ui
description: >-
  Nuxt UI (@nuxt/ui) setup with Tailwind CSS v4 for Vite Vue or Nuxt. Use when
  adding or styling U* components, theming via ui config, or Toast/Tooltip/overlays.
---

# UI kit (Nuxt UI)

This skill is present because the **UI recipe** is installed.

Docs: [Vue install](https://ui.nuxt.com/docs/getting-started/installation/vue), [Nuxt install](https://ui.nuxt.com/docs/getting-started/installation/nuxt).

## Setup

| Surface | Path / wiring |
| --- | --- |
| CSS | Vite: `src/styles/globals.css` · Nuxt: `app/assets/css/main.css` (`@import "tailwindcss"` + `@import "@nuxt/ui"`) |
| Plugin / module | Vite: `@nuxt/ui/vite` + `app.use(ui)` · Nuxt: `modules: ["@nuxt/ui"]` |
| Root shell | `<UApp>` wraps the app (`src/app/index.vue` or `app/app.vue`) — required for Toast, Tooltip, overlays |
| Vite root | `#app` has `class="isolate"` in `index.html` |

Components are auto-imported with the `U` prefix (`UButton`, `UInput`, …). Prefer those over inventing wrappers unless you need app-specific defaults.

## Theme

- Vite: `ui({ ui: { colors: { … } } })` in `vite.config.ts`
- Nuxt: `ui: { … }` in `nuxt.config.ts` and/or `app.config.ts`

## Notes

- Vite generates `auto-imports.d.ts` / `components.d.ts` when Vite runs — add them to `.gitignore`; `build` runs `vite build` before `vue-tsc`.
- Do not combine with `shadcn-vue` (exclusive UI kit).
