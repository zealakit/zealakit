# Hono starter (zealakit)

Hexagonal / Clean Architecture Hono + TypeScript base. Scaffolded by [zealakit](https://github.com/).

## Layout

| Folder | Role |
| --- | --- |
| `src/domain/` | Aggregates, VOs, domain events, repository ports |
| `src/application/` | Commands/queries, handlers, DTOs, port tokens |
| `src/presentation/` | HTTP routes, request/response DTOs, middleware |
| `src/infrastructure/` | Persistence and other adapters |
| `src/shared/` | Pure cross-cutting helpers |
| `src/bootstrap/` | `main.ts`, `create-app.ts`, composition root |

See [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md).

## Scripts

```bash
pnpm install
pnpm run dev        # tsx watch
pnpm run build
pnpm run start      # node dist
pnpm run test
pnpm run test:e2e
```

When a linter recipe is applied:

- **Biome:** `pnpm run check` / `pnpm run check:write`
- **ESLint:** `pnpm run lint` / `pnpm run lint:fix`

## Agent docs

- [AGENTS.md](AGENTS.md)
- Skills under [.agents/skills/](.agents/skills/)
