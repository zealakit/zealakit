---
name: reactjs
description: >-
  Project React/Vite UI conventions and high-impact performance priorities for
  this SPA template. Use when generating or refactoring UI — not as a React
  syntax encyclopedia.
---

# React + Vite (this app)

Assume modern React knowledge. Prefer [project-structure](../project-structure/SKILL.md) for where files go. This skill only encodes **repo conventions** and **priorities that agents often miss**.

## Naming

| What | Case | Example |
| --- | --- | --- |
| Folders / source files | `kebab-case` | `product-card/index.tsx`, `use-product.ts` |
| Component / type identifiers | `PascalCase` | `export function ProductCard()` |
| Hooks / vars | `camelCase` | `useProduct` |

Do **not** create `ProductCard.tsx`. Prefer `product-card/` exporting `ProductCard`.

**Exceptions:** tooling/dotfiles (`vite.config.ts`, `tsconfig.json`, …).

## Architecture (Vite SPA)

1. Keep route-level screens lean; put reusable UI under `src/components/` (and `ui/` when a UI recipe is applied).
2. Colocate feature state with the feature; use recipe stores (Zustand / Nanostores) only when sharing is real — don’t invent global state for local UI.
3. Fetch via the project’s HTTP client (`src/lib/fetcher` when present); don’t hardcode secrets in the client bundle.
4. Prefer accessible controls (`button type="button"`, labels, keyboard paths).
5. Import UI primitives from `@/components/ui` when a kit recipe is installed; avoid unnecessary mega-barrels.

## Performance priorities (highest first)

Skip teaching basic hooks. Optimize in this order:

1. **Bundle size** — code-split heavy routes/modals (`React.lazy` / dynamic `import()`); defer non-critical third-party libs.
2. **No async waterfalls** — parallelize independent requests; cheap guards before expensive work.
3. **Re-renders** — derive during render; logic in event handlers; don’t define components inside components; use `startTransition` / `useDeferredValue` for non-urgent work. Don’t default to `useMemo`/`useCallback`.
4. **Lists** — virtualize or CSS-contain very long lists; avoid layout thrash (read then write DOM in batches).

## Anti-patterns

- One giant App component owning every screen
- Eagerly importing admin/charts/editor stacks on the first paint
- Global context for values only one subtree needs
- Client-side “micro-frameworks” that fight Vite + React Router structure in this template

## Related

- Folder layout → [project-structure](../project-structure/SKILL.md)
