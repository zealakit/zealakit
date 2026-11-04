---
name: prisma
description: >-
  Prisma persistence for this hexagonal server app (NestJS or Hono): provider /
  DATABASE_URL, schema.prisma, PRISMA token, repository adapters, queries / N+1,
  Prisma Migrate, and transactions. Use when configuring or changing Prisma.
  Does not belong in domain/.
---

# Prisma

This skill is present because the **prisma** recipe is installed.

Persistence wiring lives under `src/infrastructure/persistence/prisma/` on Nest/Hono, `src/lib/persistence/prisma/` on Next, or `server/persistence/prisma/` on Nuxt. The schema is at `prisma/schema.prisma`. Domain ports and application handlers stay ORM-free.

Aligns with `.agents/skills/structure-ddd/SKILL.md` for layer placement.

## Critical rules

1. **Domain has zero Prisma imports** — no `@prisma/client` / generated models in `domain/`.
2. **Inject or pass the client** — Nest adapters use `@Inject(PRISMA)`; Hono adapters receive the client from the composition root.
3. **Prisma models are persistence models** — map rows ↔ aggregates in persistence mappers (or adapter-local helpers).
4. **Migrations via Prisma Migrate** — `pnpm db:migrate` after env is set; do not hand-edit production schema.
5. **Run `pnpm db:generate` before implementing the client** — then narrow `PrismaClientLike` to `PrismaClient`.
6. **Prisma 7+ needs a driver adapter at runtime** — pass `{ adapter }` (or Accelerate) into `PrismaClient`; put `DATABASE_URL` in `prisma.config.ts`, not in `schema.prisma`.
7. **ORM-agnostic adapter names** — `item.repository.adapter.ts`, not `prisma-item.repository.ts`.
8. **Avoid N+1** — prefer `include` / `select` and batched queries over loops of `findUnique`.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Provider, env, Nest module / Hono client | [setup.md](references/setup.md) |
| schema.prisma, PRISMA token, adapters | [adapters.md](references/adapters.md) |
| Queries and avoiding N+1 | [queries.md](references/queries.md) |
| migrate / generate | [migrations.md](references/migrations.md) |
| `$transaction` | [transactions.md](references/transactions.md) |

## Quick checklist

```text
[ ] Set provider in prisma/schema.prisma (no url there)
[ ] Set DATABASE_URL for prisma.config.ts
[ ] pnpm db:generate
[ ] Install driver adapter (e.g. @prisma/adapter-pg) + implement createPrismaClient({ adapter })
[ ] Uncomment PrismaPersistenceModule / createPrismaClient after env is ready
[ ] Pass PRISMA / client into <name>.repository.adapter.ts
[ ] Keep domain/<feature>/repositories/<name>.repository.ts as the port
```

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| Import `@prisma/client` from domain | Ports + adapter mapping |
| `for (id of ids) await prisma.x.findUnique` | `findMany({ where: { id: { in: ids } } })` |
| Edit production DB without migrate | `db:migrate` → review SQL → deploy |
| Commit a half-configured client that throws at import | Keep factory stub until generate + env |

## External docs

- https://www.prisma.io/docs
