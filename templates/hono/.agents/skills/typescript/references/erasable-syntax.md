# Erasable syntax & type-stripping

## Agent pitfalls

- `erasableSyntaxOnly` forbids syntax that emits JS helpers (enums, namespaces, parameter properties, etc.).
- Node type-stripping / Bun TS / browsers “types as comments” only work if types erase cleanly.
- Classic `enum` and `namespace` are legacy ESM workarounds — prefer modules + unions.
- Don’t enable `erasableSyntaxOnly` mid-migration without a codemod plan.

## Prefer (erasable)

| Pattern | Example |
| --- | --- |
| `type` / `interface` | `type Id = string` |
| `import type` | `import type { X } from "./x.js"` |
| `as const` objects | `const Role = { Admin: "admin" } as const` |
| Generics / mapped types | compile-time only |
| `satisfies` | type-check without emit |

## Avoid under `erasableSyntaxOnly`

| Feature | Replacement |
| --- | --- |
| `enum` / `const enum` | `as const` + union |
| `namespace` / `module` (non-ESM) | ES modules |
| Parameter properties | Explicit fields + assignments |
| Legacy `export =` / `import x = require` | ESM `import`/`export` |

```ts
// Instead of enum
const Color = { Red: "red", Blue: "blue" } as const
type Color = (typeof Color)[keyof typeof Color]

// Instead of parameter properties
class User {
  name: string
  constructor(name: string) {
    this.name = name
  }
}
```

## When to enable

Enable `erasableSyntaxOnly` when:

- Running `.ts` directly via type-stripping runtimes, or
- Targeting a pipeline that erases types without executing TS transforms.

Keep it off when you intentionally depend on emit features (rare in greenfield ESM apps).

## Verify

```bash
pnpm exec tsc --noEmit --erasableSyntaxOnly
```
