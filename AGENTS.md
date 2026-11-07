# Agent instructions (zealakit kit)

This repo builds and maintains **zealakit** — a recipe-based scaffolding CLI.
It is **not** a consumer frontend app. Skills under `templates/` and `recipes/` are for _generated_ projects.

## Always follow

- **Kit architecture:** [.agents/skills/zealakit/SKILL.md](.agents/skills/zealakit/SKILL.md) — layout, registry, scaffolder, conventions
- **Extending:** [.agents/skills/zealakit/extending.md](.agents/skills/zealakit/extending.md) — add templates/recipes/overlays
- **Rules:** [.agents/rules/](.agents/rules/)

## Quick map

| Area                                                   | Path                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CLI                                                    | `apps/cli/`                                                                                                                                |
| Core engine                                            | `packages/core/`                                                                                                                           |
| Node ecosystem                                         | `packages/ecosystem-node/`                                                                                                                 |
| Go ecosystem                                           | `packages/ecosystem-go/`                                                                                                                   |
| Templates                                              | `templates/node/` + `templates/go/{stdlib-api,gin-api,stdlib-worker}`                                                                      |
| Recipes                                                | `recipes/node/` (Go recipes not yet)                                                                                                       |
| Tests                                                  | `tests/` (`pnpm test`), pack smoke `scripts/test-e2e-pack.ts`                                                                              |
| Dep monitor                                            | `monitor/` (`pnpm monitor`)                                                                                                                |
| Scopes / categories / discovery enums                  | `packages/core/src/constants/` (facade `constants.ts`)                                                                                     |
| Template / Recipe discovery profiles                   | `packages/core/src/profiles/`                                                                                                              |
| Discovery (intent questionnaire → resolver → matching) | `packages/core/src/discovery/` (non-technical answers; `resolveDiscoveryRequirements`; match by `ui` / `server-api` / `background-worker`) |
| Discovery CLI UI                                       | `apps/cli/src/discovery/` (`zealakit create --discover`)                                                                                   |
| Discovery local feedback                               | `packages/core/src/discovery/feedback/` + `zealakit discovery stats` / `feedback`                                                          |
| Project types (Discovery)                              | `packages/core/src/constants/project-types.ts` — distinct from template `Scope`                                                            |

Published package is the **root** `zealakit` npm package (`dist` + `templates` + `recipes`). Workspace packages are private and bundled into `dist/`.

Path alias `@/*` applies inside **templates**, not the kit packages.
