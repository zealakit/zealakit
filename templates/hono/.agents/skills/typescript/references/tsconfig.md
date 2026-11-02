# tsconfig & project layout

## Agent pitfalls

- TS **6/7** change defaults: `strict`, `types: []`, `rootDir`, `noUncheckedSideEffectImports`.
- Don’t copy an old “loose” `tsconfig` into a new project.
- `module` / `moduleResolution` must match **runtime or bundler**, not a UI framework.
- `ignoreDeprecations: "6.0"` is a migration crutch — **removed in TS 7**.
- Listing `"types": ["*"]` re-enables ambient auto-include (old behavior).

## Baseline options (meaning)

| Option | Why |
| --- | --- |
| `strict` | Full strict family (null checks, etc.) — default true in 6+/7 |
| `verbatimModuleSyntax` | Forces clear type vs value imports |
| `isolatedModules` | Safe for transpile-only / bundlers |
| `noUncheckedIndexedAccess` | `obj[key]` is `T \| undefined` |
| `exactOptionalPropertyTypes` | Distinguishes missing vs `undefined` |
| `noImplicitOverride` | Requires `override` keyword |
| `skipLibCheck` | Faster builds; skip `.d.ts` deep check |
| `noUncheckedSideEffectImports` | Fail on unresolved `import "./x"` |

## Environment presets

### Bundler app/library

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

### Node (stable)

```json
{
  "compilerOptions": {
    "module": "node20",
    "moduleResolution": "node20"
  }
}
```

### Node (latest floating)

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext"
  }
}
```

## Project references (monorepo)

```json
{
  "files": [],
  "references": [{ "path": "./packages/core" }, { "path": "./packages/api" }]
}
```

Package `tsconfig`:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Build with `tsc -b` (TS 7 can parallelize via `--builders`).

## Path aliases

Prefer package exports / relative imports in libraries. If using paths:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Ensure the **bundler/runtime** resolves the same aliases — `tsc` paths alone don’t rewrite at runtime unless you emit with a tool that understands them.

## Includes / excludes

```json
{
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Keep tests in a separate project reference or explicit include when types differ (DOM vs Node).
