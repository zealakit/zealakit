---
name: typescript
description: >-
  Project TypeScript conventions for this Nest backend (strict, nodenext,
  import type, DI-friendly types). Use when typing modules or reviewing .ts —
  not as a TypeScript language encyclopedia.
---

# TypeScript (this repo)

Assume modern TypeScript fluency. Prefer [structure-ddd](../structure-ddd/SKILL.md) for placement and [nestjs](../nestjs/SKILL.md) for framework patterns.

## Critical rules

1. **`strict` on** — don’t weaken for convenience.
2. **`unknown` > `any`** — narrow at boundaries (HTTP, ORM, env).
3. **Erasable types** — prefer `type` / `interface` / `import type`; avoid emit-only features unless required.
4. **Prefer `type` for app models**; use `interface` when Nest/DI or declaration merging needs it.
5. **Discriminated unions** over boolean flag soup.
6. **No `enum` by default** — prefer `as const` + union types.
7. **ESM + `nodenext`** — keep `.js` extensions on relative and `@/` imports.
8. **Public exports** — explicit types when inference is opaque.
9. **Don’t fight the checker with `as`** — assert only at trusted I/O edges.
10. **Respect root `tsconfig`** — don’t invent a second module story.

## Nest-specific typing

- Inject ports via tokens; type constructors with the port type, not the adapter class.
- DTO classes at presentation may use `class-validator` decorators; keep domain types decorator-free.
- Prefer branded/`readonly` fields on domain VOs when it clarifies intent.

## Related

- Runtime idioms → [javascript](../javascript/SKILL.md)
- Nest → [nestjs](../nestjs/SKILL.md)
- Layout → [structure-ddd](../structure-ddd/SKILL.md)
- Handbook: https://www.typescriptlang.org/docs/handbook/intro.html
