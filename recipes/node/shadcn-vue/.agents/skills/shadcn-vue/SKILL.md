---
name: shadcn-vue
description: >-
  shadcn-vue setup: Tailwind CSS v4, CSS variables, and primitive components in
  components/ui (new-york). Use when adding or styling UI, or running the
  shadcn-vue CLI to add more components (Vite Vue or Nuxt).
---

# UI kit (shadcn-vue)

This skill is present because the **UI recipe** is installed.

## Setup

- Theme tokens / CSS variables:
  - Vite Vue: `src/styles/globals.css`
  - Nuxt: `app/assets/css/main.css` (+ `shadcn-nuxt` in `nuxt.config.ts`)
- Primitives:
  - Vite Vue: `src/components/ui/`
  - Nuxt: `app/components/ui/`
  (kebab-case folders; each component has its own `index.ts`)
- CLI config: `components.json` (style `new-york`, base color `neutral`)
- Class helper: `cn` via `@/lib/utils` (`other.ts` + `clsx` / `tailwind-merge`)
- Add more components: `npx shadcn-vue@latest add <component>`
- Nuxt: do **not** add a root `components/ui/index.ts` — it breaks Nuxt/`shadcn-nuxt` path resolution

## Imports

```ts
import { Button } from "@/components/ui/button";
```

When a primitive needs extra props or app-specific defaults, edit its file under `components/ui/`. Use the shadcn-vue CLI to add new primitives instead of inventing one-off copies.

## Theme

Edit CSS variables in the globals/main CSS file above. Dark mode is class-based (`.dark`).
