---
name: shadcn-ui
description: >-
  shadcn/ui setup for this SPA: Tailwind CSS, CSS variables, and primitive
  components in components/ui (base-vega). Use when adding or styling UI, or
  running the shadcn CLI to add more components.
---

# UI kit (shadcn/ui)

This skill is present because the **UI recipe** is installed.

## Setup

- Theme tokens / CSS variables:
  - Vite: `src/styles/globals.css` (or `global.css` from the vite overlay)
  - Next: `src/app/globals.css`
- Primitives: `src/components/ui/` (real files — one kebab-case file per primitive, barrel in `index.ts`)
- CLI config: `components.json` (style `base-vega`; `rsc: true` on Next)
- Class helper: `cn` via `@/lib/utils` (`other.ts` + the `cn` package)
- Add more components: `npx shadcn@^4.21.0 add <component>`

## Imports

Prefer the project wrappers when a wrapper exists:

```ts
import { Button } from "@/components/ui";
```

When a primitive needs extra props or app-specific defaults, edit its file under `components/ui/`. Use the shadcn CLI to add new primitives instead of inventing one-off copies.

## Theme

Edit CSS variables in the theme stylesheet (`src/styles/globals.css` or `src/app/globals.css` on Next). Dark mode is class-based (`.dark`).
