---
name: reactjs
description: >-
  React island patterns for this Astro project: local state, accessible
  controls, and keeping interactivity out of static pages. Use when writing or
  refactoring .tsx islands rendered from .astro files.
---

# React islands

React runs **inside Astro islands**, not as the application framework.

## Practices

1. Keep island state local (`useState` / recipe stores) unless sharing across islands is required (then Nanostores / Zustand — still island-scoped providers).
2. Prefer small, focused components over large client trees.
3. Use accessible markup (`button type="button"`, labels, etc.).
4. Do not import server-only modules or private env into islands.
5. Colocate islands under `src/components/<name>/index.tsx` (kebab-case folder; split helpers in the same folder as needed).
6. When a UI recipe is installed, import primitives from `@/components/ui`.

## Anti-patterns

- Hydrating a whole page layout with React
- Replacing Astro pages with a client router
- Shipping unused client JS “just in case”
