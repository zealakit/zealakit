---
name: reactjs
description: >-
  Project React/Next UI conventions and high-impact performance priorities for
  this App Router template. Use when generating or refactoring UI — not as a
  React syntax encyclopedia.
---

# React + Next.js (this app)

Assume modern React / Next App Router knowledge. Prefer [project-structure](../project-structure/SKILL.md) for where files go. This skill only encodes **repo conventions** and **priorities that agents often miss**.

## Naming

| What | Case | Example |
| --- | --- | --- |
| Folders / source files | `kebab-case` | `product-card/index.tsx`, `use-product.ts` |
| Component / type identifiers | `PascalCase` | `export function ProductCard()` |
| Hooks / vars | `camelCase` | `useProduct` |

Do **not** create `ProductCard.tsx`. Prefer `product-card/` exporting `ProductCard`.

**Exceptions:** framework-reserved names (`page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts`, …) and tooling configs.

## Architecture (Next-specific)

1. Default to **Server Components**. Add `'use client'` only for interactivity, browser APIs, or client-only libraries.
2. Keep page/route files thin: compose widgets from the route group; shared chrome in `src/components/` / layouts per project-structure.
3. Fetch on the server when data can be resolved for the request; keep secrets and privileged env off the client.
4. Treat Server Actions / route handlers like APIs — authenticate and authorize before mutating.
5. When a UI recipe is installed, import primitives from `@/components/ui` (one-level imports; avoid mega-barrels where tree-shaking suffers).

## Performance priorities (highest first)

Skip teaching basic hooks. Optimize in this order:

1. **No request waterfalls** — parallelize independent async work (`Promise.all`); await only when needed; cheap guards before expensive I/O.
2. **Bundle size** — dynamic-import heavy client UI; avoid pulling large libraries into the critical path; prefer direct imports over fat barrels when it matters.
3. **RSC boundaries** — pass minimal serializable props across server→client; don’t ship duplicate data or giant trees as props.
4. **Re-renders** — derive values during render; put side effects in event handlers; avoid defining components inside components; use `startTransition` / `useDeferredValue` for non-urgent updates. Don’t sprinkle `useMemo`/`useCallback` by default.
5. **Lists / hydration** — virtualize or use CSS containment for huge lists; fix real hydration mismatches, don’t blanket-suppress.

## Anti-patterns

- Client components as the default for every page
- Sequential awaits that could run in parallel
- Fetching the same data repeatedly without request-level dedupe (`cache`) when composition allows
- Large client providers wrapping the entire app “just in case”
- Inventing a Pages Router / `src/pages` tree in this App Router app

## Related

- Folder layout & server/client file split → [project-structure](../project-structure/SKILL.md)
