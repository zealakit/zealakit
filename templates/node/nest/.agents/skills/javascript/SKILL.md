---
name: javascript
description: >-
  Project JavaScript runtime conventions for this Nest backend (ESM, async,
  naming). Use sparingly — models already know JS syntax; prefer typescript +
  nestjs / structure-ddd for most work.
---

# JavaScript (this repo)

Assume modern JS fluency. This skill only records **repo defaults**.

## Conventions

1. **ESM only** — keep `.js` extensions in relative/`@/` imports under `nodenext`.
2. **`const` by default**; `let` only when reassignment is required. Never `var`.
3. **`===` / `??` / `?.`** — avoid `==` except `value == null`.
4. **Async** — prefer `async`/`await`; parallelize independent work with `Promise.all`; don’t swallow errors.
5. **Naming** — `camelCase` values/functions, `PascalCase` classes, `kebab-case` files/folders.
6. **No clever control flow** — early returns over deep nesting.

## Related

- Types / `tsc` → [typescript](../typescript/SKILL.md)
- Nest patterns → [nestjs](../nestjs/SKILL.md)
- Folder layout → [structure-ddd](../structure-ddd/SKILL.md)
