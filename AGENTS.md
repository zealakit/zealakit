# Agent instructions (zealakit kit)

This repo builds and maintains **zealakit** — a recipe-based scaffolding CLI.
It is **not** a consumer frontend app. Skills under `templates/` and `recipes/` are for _generated_ projects.

## Always follow

- **Kit architecture:** [.agents/skills/zealakit/SKILL.md](.agents/skills/zealakit/SKILL.md) — layout, registry, scaffolder, conventions
- **Extending:** [.agents/skills/zealakit/extending.md](.agents/skills/zealakit/extending.md) — add templates/recipes/overlays
- **Rules:** [.agents/rules/](.agents/rules/)

## Quick map

| Area                 | Path                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| CLI                  | `apps/cli/`                                                                                                                    |
| Core engine          | `packages/core/`                                                                                                               |
| TypeScript ecosystem | `packages/ecosystem-typescript/`                                                                                               |
| Templates            | `templates/typescript/` (`vite-react`, `vite-vue`, `astro-react-client`, `astro-react-hybrid`, `next`, `nuxt`, `nest`, `hono`) |
| Recipes              | `recipes/typescript/`                                                                                                          |
| Tests                | `tests/` (`pnpm test`), pack smoke `scripts/test-e2e-pack.ts`                                                                  |
| Dep monitor          | `monitor/` (`pnpm monitor`)                                                                                                    |
| Scopes / categories  | `packages/core/src/constants.ts`                                                                                               |

Published package is the **root** `zealakit` npm package (`dist` + `templates` + `recipes`). Workspace packages are private and bundled into `dist/`.

Path alias `@/*` applies inside **templates**, not the kit packages.
