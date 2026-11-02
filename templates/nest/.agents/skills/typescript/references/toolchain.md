# Toolchain — tsc, watch, TS 7 parallelism

## Agent pitfalls

- Prefer **project-local** `typescript` over a random global `tsc`.
- TS **7** speeds up builds; language rules match **6.0**.
- TS 7 may need `@typescript/typescript6` side-by-side for tools that import the old JS API.
- Raising `--checkers` / `--builders` increases memory — tune for CI.
- `tsc` is a typechecker/emitter — bundling/minify is not its job.

## Common commands

```bash
pnpm exec tsc --noEmit          # typecheck only
pnpm exec tsc -b                # project references build
pnpm exec tsc --watch
pnpm exec tsc --showConfig      # print effective config
```

## TypeScript 7 parallelism

```bash
pnpm exec tsc --noEmit --checkers 4
pnpm exec tsc -b --builders 2 --checkers 4
pnpm exec tsc --singleThreaded   # debug / tiny CI runners
```

Defaults are reasonable; measure before tuning.

## Dual 6 + 7 (tooling bridge)

Until TS 7.1 ships a new programmatic API, eslint-style tools may need TS 6 API:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.0",
    "typescript": "npm:@typescript/typescript6@^6.0.0"
  }
}
```

- `tsc` from the native alias for speed, or run via package scripts explicitly.
- Follow the [TS 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) for the latest recommended alias layout.

## Editor

- Use the workspace TypeScript version (VS Code: “Use Workspace Version”).
- TS 7 may use a dedicated editor/LSP path — follow editor docs when diagnostics look stale.

## CI recommendations

1. `pnpm exec tsc --noEmit` (or `-b`) on every PR.
2. Fail on new `any` / lint rules separately if desired.
3. Cache dependency install; TS 7 reduces typecheck wall time significantly on large repos.
4. Pin `typescript` major intentionally (6 vs 7) in lockfile.

## What not to do

- Don’t commit conflicting `tsconfig` that disables `strict` “temporarily” forever.
- Don’t use `skipLibCheck: false` as a default on huge dependency trees unless diagnosing `.d.ts` bugs.
- Don’t treat `tsc` emit as a bundler for apps — use the project’s bundler; keep `tsc` for types (and library `.d.ts` emit when publishing).
