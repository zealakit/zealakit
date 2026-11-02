---
name: type-orm
description: >-
  TypeORM persistence for this hexagonal server app (NestJS or Hono): driver
  setup, DataSource / TypeOrmModule, orm-entities, repository adapters, joins /
  N+1, migrations, and transactions. Use when configuring or changing TypeORM.
  Does not belong in domain/.
---

# TypeORM

This skill is present because the **type-orm** recipe is installed.

Persistence wiring lives under `src/infrastructure/persistence/typeorm/`. Domain ports and application handlers stay ORM-free. **No database driver is pre-selected** — install one when you know the target DB.

Aligns with `.agents/skills/structure-ddd/SKILL.md` for layer placement.

## Critical rules

1. **Domain has zero TypeORM imports** — no `@Entity`, `Repository`, or `DataSource` in `domain/` or application handlers.
2. **Decorate persistence models only** — put `@Entity()` / columns on `*.orm-entity.ts`, not on aggregates.
3. **Adapters implement ports** — inject `Repository` / `DataSource` inside `*.repository.adapter.ts`; map to/from domain via persistence mappers.
4. **Feature registration** — Nest: `TypeOrmModule.forFeature([...])` in the feature module; Hono: pass `DataSource` into the adapter from the composition root.
5. **Never ship `synchronize: true` to production** — use migrations for schema changes.
6. **Do not commit a default driver** — add `pg` / `mysql2` / `better-sqlite3` in the app when the DB is decided.
7. **ORM-agnostic adapter names** — `item.repository.adapter.ts`, not `typeorm-item.repository.ts`.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Driver, env, Nest module / Hono DataSource | [setup.md](references/setup.md) |
| Entities, mappers, feature binding | [adapters.md](references/adapters.md) |
| Joins, relations, avoiding N+1 | [queries.md](references/queries.md) |
| Migrations vs synchronize | [migrations.md](references/migrations.md) |
| Multi-step consistency | [transactions.md](references/transactions.md) |

## Quick checklist

```text
[ ] Install DB driver + set DB_TYPE / DATABASE_URL (or host credentials)
[ ] Uncomment TypeormPersistenceModule / createTypeOrmDataSource after env is ready
[ ] Decorate infrastructure .../entities/<name>.orm-entity.ts with TypeORM
[ ] Implement <name>.repository.adapter.ts against the domain port
[ ] Nest: TypeOrmModule.forFeature + token bind; Hono: new Adapter(dataSource)
[ ] Prefer migrations; keep DB_SYNCHRONIZE off outside local experiments
```

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| `@Entity()` on a domain aggregate | Decorate `*.orm-entity.ts` only |
| Import `typeorm` from a handler | Call the port; adapter owns TypeORM |
| Lazy-load relations inside a loop | `relations` / `QueryBuilder` joins / batch load |
| `synchronize: true` in production | Migrations with `up` / `down` |
| Hardcode sqlite/postgres in the recipe | Env + install driver in the generated app |

## External docs

- https://typeorm.io
- https://docs.nestjs.com/techniques/database
