---
name: drizzle-orm
description: >-
  Drizzle ORM persistence for this hexagonal server app (NestJS or Hono): dialect
  / driver choice, schema.ts, DRIZZLE token, repository adapters, joins / N+1,
  drizzle-kit migrations, and transactions. Use when configuring or changing
  Drizzle. Does not belong in domain/.
---

# Drizzle ORM

This skill is present because the **drizzle-orm** recipe is installed.

Persistence wiring lives under `src/infrastructure/persistence/drizzle/`. Domain ports and application handlers stay ORM-free. **No dialect or driver is pre-selected.**

Aligns with `.agents/skills/structure-ddd/SKILL.md` for layer placement.

## Critical rules

1. **Domain has zero Drizzle imports** — no `drizzle-orm` / table schemas in `domain/`.
2. **Inject or pass the client** — Nest adapters use `@Inject(DRIZZLE)`; Hono adapters receive the client from the composition root.
3. **Schemas are persistence models** — map rows ↔ aggregates in persistence mappers (or adapter-local helpers).
4. **Migrations via drizzle-kit** — `pnpm db:generate` / `pnpm db:migrate` after env is set; do not hand-edit production schema.
5. **Do not commit a default dialect** — leave `schema.ts` / `drizzle.client.ts` as stubs until the DB is chosen.
6. **ORM-agnostic adapter names** — `item.repository.adapter.ts`, not `drizzle-item.repository.ts`.
7. **Prefer explicit SQL/joins** — Drizzle does not lazy-load relations; N+1 is usually “loop of queries you wrote”.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Dialect, driver, Nest module / Hono client | [setup.md](references/setup.md) |
| schema.ts, DRIZZLE token, adapters | [adapters.md](references/adapters.md) |
| Selects, joins, avoiding N+1 | [queries.md](references/queries.md) |
| drizzle-kit generate / migrate | [migrations.md](references/migrations.md) |
| `db.transaction` | [transactions.md](references/transactions.md) |

## Quick checklist

```text
[ ] Install driver + implement createDrizzleClient()
[ ] Add tables in schema.ts with the correct *-core import
[ ] Set DB_DIALECT + DATABASE_URL for drizzle-kit
[ ] Uncomment DrizzlePersistenceModule / createDrizzleClient after env is ready
[ ] Pass DRIZZLE / client into <name>.repository.adapter.ts
[ ] Keep domain/<feature>/repositories/<name>.repository.ts as the port
```

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| Ship sqliteTable / better-sqlite3 in the recipe | Stubs + install dialect/driver in the app |
| Import `schema.ts` from domain | Ports + adapter mapping |
| `for (id of ids) await db.select()…` | One `inArray` / join query |
| Edit production DB without drizzle-kit | `db:generate` → review → `db:migrate` |

## External docs

- https://orm.drizzle.team/docs/overview
- https://orm.drizzle.team/docs/get-started
