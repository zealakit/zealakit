---
name: vuejs
description: >-
  Vue 3 + Vue Router practices for this SPA. Use when generating, refactoring,
  or optimizing Vue SFCs, composition API hooks, or route modules. Does not
  pick a UI kit, HTTP client, or store — those come from recipes.
---

# Vue UI

Prefer Vue 3 `<script setup lang="ts">` SFCs. Keep screens thin; put logic in
`composables/` and shared chrome in optional `FeatureShell`.

## Hard rules

- kebab-case **files/folders**; PascalCase **component names**
- Feature screens: `list.vue`, `login.vue`, … under `src/app/features/<feature>/`
- Routes live in `src/app/router/*.ts` — lazy `() => import(...)`, paths from `CONSTANTS.ROUTES`
- Prefer `type` over `interface`; path alias `@/*` → `src/*`
- Place files using [.agents/skills/project-structure/SKILL.md](../project-structure/SKILL.md)

## Composition API

- Use `ref` / `reactive` / `computed` for local state
- Extract reusable logic into `use*` functions under `composables/`
- Provide/inject for feature chrome (`FeatureShell`); do not invent global event buses

## Performance

- Lazy-load route components
- Keep `v-if` vs `v-show` intentional; avoid heavy work in templates
- Prefer computed over methods that recompute the same value in render
