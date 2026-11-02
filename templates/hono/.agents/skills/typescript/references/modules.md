# Modules, imports & declarations

## Agent pitfalls

- Under `verbatimModuleSyntax`, type-only imports must use `import type`.
- Side-effect imports are checked when `noUncheckedSideEffectImports` is on (default 6+/7).
- `export default` hurts inference across packages — prefer named exports.
- Declaration emit (`declaration: true`) needs export types to be nameable — avoid exposing anonymous messy inferences from public APIs.
- Path aliases must be mirrored by the bundler/runtime.

## Type-only imports

```ts
import type { User } from "./user.js"
import { createUser, type UserId } from "./user.js"
```

## Re-exports

```ts
export type { User } from "./user.js"
export { createUser } from "./user.js"
```

Avoid deep barrel files that re-export entire trees (hurts load and cycles). Shallow package entrypoints are fine.

## `import defer` (TS 5.9+)

```ts
import defer * as heavy from "./heavy-lib.js"

export function run() {
  return heavy.compute() // executes module on first access
}
```

- Namespace form only (`* as`).
- Needs runtime/bundler support; TS does not downlevel this away.
- Only for side-effect-light modules.

## Ambient modules

```ts
declare module "*.css" {
  const css: string
  export default css
}
```

Keep ambient modules rare and local to app shims — libraries should ship real `.d.ts`.

## Triple-slash / `types` array

With TS 6/7 default `types: []`, pull globals intentionally:

```json
{ "compilerOptions": { "types": ["node"] } }
```

## Dual packages / `exports`

When publishing, align `package.json` `"exports"` with emitted ESM/CJS. Prefer ESM-first; keep CJS only if required.

## Isolated declarations

`isolatedDeclarations` requires explicit types on exported shapes for parallel `.d.ts` emit — good for large monorepos / TS 7 builders.
