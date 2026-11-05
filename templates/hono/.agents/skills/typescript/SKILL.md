---
name: typescript
description: >-
  Project TypeScript conventions for this Hono backend (strict, nodenext,
  import type). Use when typing modules or reviewing .ts — not as a TypeScript
  language encyclopedia.
---

# TypeScript (this repo)

Assume modern TypeScript fluency. Prefer [structure-ddd](../structure-ddd/SKILL.md) for placement and [hono](../hono/SKILL.md) for framework patterns.

## Critical rules

1. **`strict` on** — don’t weaken for convenience.
2. **`unknown` > `any`** — narrow at boundaries (HTTP, ORM, env).
3. **Erasable types** — prefer `type` / `interface` / `import type`; avoid emit-only features unless required.
4. **Prefer `type` for app models**; use `interface` only when declaration merging is required.
5. **Discriminated unions** over boolean flag soup.
6. **No `enum` by default** — prefer `as const` + union types.
7. **ESM + `nodenext`** — keep `.js` extensions on relative and `@/` imports.
8. **Public exports** — explicit types when inference is opaque.
9. **Don’t fight the checker with `as`** — assert only at trusted I/O edges.
10. **Respect root `tsconfig`** — don’t invent a second module story.

## Hono-specific typing

- Type route handlers with validated input types at the edge.
- Keep domain types free of Hono/`Context` imports.
- Prefer ports typed as `type` aliases injected via bootstrap factories.

## Related

- Runtime idioms → [javascript](../javascript/SKILL.md)
- Hono → [hono](../hono/SKILL.md)
- Layout → [structure-ddd](../structure-ddd/SKILL.md)
- Handbook: https://www.typescriptlang.org/docs/handbook/intro.html
