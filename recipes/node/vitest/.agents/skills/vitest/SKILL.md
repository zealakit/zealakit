---
name: vitest
description: Write and run unit and component tests with Vitest. Use when adding tests, fixing failing tests, or changing the test setup.
---

# Vitest

## Commands

- `test` — run the suite once (CI)
- `test:watch` — watch mode while developing

## Where tests live

- Colocate tests as `*.test.ts` / `*.test.tsx` next to the code (or under `src/test/`; Nuxt uses `tests/`).
- `vitest.config.ts` is separate from the app's Vite config: change the test environment, aliases, and setup files there.
- Shared setup (matchers, cleanup) lives in `src/test/setup.ts` where the framework needs one.

## Conventions

- Test behavior through the rendered output (Testing Library / Vue Test Utils), not implementation details.
- Prefer `userEvent` over `fireEvent` for interactions; always `await` it.
- Import `describe` / `it` / `expect` from `vitest` explicitly (no globals).
- Keep tests deterministic: no real network or timers; mock at the module boundary with `vi.mock`.
- The environment is jsdom (happy-dom for Nuxt). Browser-only APIs missing there need a stub in the setup file.
