---
name: typescript
description: >-
  Core TypeScript language conventions for TypeScript 7.x / 6.x: typing,
  tsconfig, modules, narrowing, generics, and erasable-syntax hygiene. Use when
  writing, reviewing, refactoring, or configuring any .ts/.tsx code or tsconfig —
  independent of frameworks (React, Nest, Hono, etc.).
---

# TypeScript

**Target toolchain:** TypeScript **7.x** (native Go compiler, Jul 2026) with **6.0** language/config semantics. Prefer patterns that type-check under modern defaults (`strict`, ESM-first) without framework-specific APIs.

TypeScript adds a static type system on top of JavaScript. Prefer **clarity and soundness** over clever types. If a type requires a paragraph of explanation, simplify the design.

Aligns with [javascript](../javascript/SKILL.md) for runtime/idiom rules; this skill owns **types and `tsc`**.
Nest framework → [nestjs](../nestjs/SKILL.md). Folder/layer layout → [structure-ddd](../structure-ddd/SKILL.md).

---

## Current platform notes (TS 7 / 6)

| Fact | Implication |
| --- | --- |
| TS **7.0** = native port (~8–12× faster `tsc` / editor) | Install via `typescript` npm package; same type rules as 6.0 |
| TS **7** does not ship the old programmatic API yet | Tools needing `typescript` JS API (e.g. eslint) may use `@typescript/typescript6` side-by-side until 7.1 |
| **6.0 defaults** apply in 7.0 | `strict: true`, ESM-oriented `module`/`target`, `types: []`, stricter `rootDir` |
| Parallelism | Optional `--checkers` / `--builders`; `--singleThreaded` for constrained CI |

```bash
# Prefer project-local compiler
pnpm add -D typescript
pnpm exec tsc --version
```

---

## Critical rules

1. **`strict` on** (default in 6+/7). Do not weaken unless migrating legacy code with an explicit plan.
2. **Types are erasable** — prefer type-only constructs that strip cleanly (`interface`, `type`, `import type`). Avoid relying on emit-time features when the runtime/bundler only strips types.
3. **`unknown` > `any`.** Narrow before use. `any` is an escape hatch, not a habit.
4. **Prefer `interface` for object shapes** that may be extended; `type` for unions, intersections, mapped/conditional types, and tuples.
5. **Don’t fight the checker with `as`.** Prefer narrowing, generics, and proper modeling. Assert only at trusted boundaries (I/O, legacy).
6. **Public APIs need explicit types** on exports when inference is opaque or unstable.
7. **Discriminated unions** over boolean flag soup / optional fields that lie.
8. **No enum unless required** — prefer `as const` objects + union types (friendlier to `erasableSyntaxOnly` / type-stripping runtimes).
9. **Modules are ESM.** Prefer `verbatimModuleSyntax` / `import type` clarity.
10. **Respect project `tsconfig`** — don’t invent a second module/target story that contradicts the repo.

---

## Recommended `tsconfig` baseline (greenfield)

Stack-agnostic starting point. Adjust `module` / `moduleResolution` for the **runtime or bundler** (Node, Deno, Bun, Vite, etc.) — not for a UI framework.

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2024",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2024"],
    "noUncheckedSideEffectImports": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "types": [],
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

| Environment | Typical module settings |
| --- | --- |
| Bundler (Vite, etc.) | `module: esnext`, `moduleResolution: bundler` |
| Node 20+ (stable model) | `module` / `moduleResolution`: `node20` (implies modern target) |
| Floating Node latest | `nodenext` |
| Type-strip / no emit runtime | Enable `erasableSyntaxOnly`; avoid enums / namespaces / parameter properties |

**TS 6/7 gotchas**

- `types` defaults to `[]` — list globals explicitly (e.g. `"node"`) when needed; `"*"` restores old auto-include.
- Set `rootDir` explicitly when `tsconfig` is outside `src/`.
- `stableTypeOrdering` is fixed on in 7 — don’t depend on unstable ordering hacks.

---

## Typing essentials

### Narrowing

```ts
function handle(value: string | number) {
  if (typeof value === "string") return value.toUpperCase()
  return value.toFixed(2)
}

type Result =
  | { ok: true; data: string }
  | { ok: false; error: string }

function message(r: Result) {
  return r.ok ? r.data : r.error
}
```

### Generics — constrain, don’t over-abstract

```ts
function pick<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

### `unknown` at boundaries

```ts
function parseJson(text: string): unknown {
  return JSON.parse(text)
}

function isUser(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  )
}
```

### Const objects instead of enums

```ts
const Status = {
  Draft: "draft",
  Published: "published",
} as const

type Status = (typeof Status)[keyof typeof Status]
```

### Satisfies

```ts
const config = {
  port: 3000,
  mode: "dev",
} as const satisfies { port: number; mode: "dev" | "prod" }
```

---

## Modules & imports

```ts
import type { User } from "./user.js"
import { createUser } from "./user.js"

export type { User }
export { createUser }
```

- Prefer **named exports**.
- With `verbatimModuleSyntax`, use `import type` / `export type` for types.
- Side-effect imports must resolve (`noUncheckedSideEffectImports`).
- `import defer * as heavy from "./heavy.js"` (TS 5.9+) — defer execution until first property access; namespace import only; runtime/bundler must support it.

---

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| `tsconfig`, project references, TS 6/7 flags | [tsconfig.md](references/tsconfig.md) |
| Narrowing, guards, assertions, excess property checks | [narrowing.md](references/narrowing.md) |
| Generics, conditional/mapped types, `infer` | [generics.md](references/generics.md) |
| Utility types, `satisfies`, branded types | [types-toolkit.md](references/types-toolkit.md) |
| Classes, `implements`, `override`, `#private` | [classes.md](references/classes.md) |
| ESM, `import type`, path mapping, declaration emit | [modules.md](references/modules.md) |
| `erasableSyntaxOnly`, enums/namespaces to avoid | [erasable-syntax.md](references/erasable-syntax.md) |
| `tsc` / watch / checkers, dual 6+7 tooling | [toolchain.md](references/toolchain.md) |

---

## Application

When **writing** TypeScript:

- Model domain data with unions and interfaces; keep generics shallow.
- Type I/O boundaries; let internals infer when obvious.
- Match the repo’s `module` / `jsx` / path alias settings — never invent framework types here.

When **reviewing**:

- Flag `any`, unjustified `as`, weakened `strict`, non-erasable syntax in type-strip projects, and public APIs without stable exported types.

## Anti-patterns

| Don’t | Do |
| --- | --- |
| `any` everywhere | `unknown` + narrow |
| `as Type` to silence errors | Fix the model / narrow |
| Numeric / string `enum` by default | `as const` + union |
| Parameter properties + namespaces in type-strip apps | Explicit fields + ESM |
| Empty `catch (e)` typed as `any` | `unknown` + narrow (`useUnknownInCatchVariables`) |
| Rely on ambient `@types/*` auto-load under TS 6/7 | Explicit `"types": ["node", …]` when needed |
| Framework-specific patterns in this skill | Keep this skill language-only |
