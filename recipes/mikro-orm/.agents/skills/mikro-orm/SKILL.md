---
name: mikro-orm
description: >-
  MikroORM persistence for this hexagonal server app (NestJS or Hono): driver
  setup, orm-entities, EntityManager adapters, populate / N+1, migrations, and
  transactions/UoW. Use when configuring or changing MikroORM. Does not belong
  in domain/.
---

# MikroORM

This skill is present because the **mikro-orm** recipe is installed.

Persistence wiring lives under `src/infrastructure/persistence/mikro-orm/` on Nest/Hono, `src/lib/persistence/mikro-orm/` on Next, or `server/persistence/mikro-orm/` on Nuxt. Domain ports and application handlers stay ORM-free. **No database driver is pre-selected.**

Aligns with `.agents/skills/structure-ddd/SKILL.md` for layer placement.

## Critical rules

1. **Domain has zero MikroORM imports** — no `@Entity`, `EntityManager`, or driver packages in `domain/`.
2. **Decorators from legacy package** — with `experimentalDecorators`, import `@Entity` / `@Property` from `@mikro-orm/decorators/legacy`.
3. **Drivers from the driver package** — import `EntityManager` / `PostgreSqlDriver` from `@mikro-orm/postgresql` (or mysql/sqlite), not only from `@mikro-orm/core`.
4. **Adapters implement ports** — inject or pass `EntityManager` inside `*.repository.adapter.ts`; map via persistence mappers.
5. **Prefer migrations over schema sync in shared environments** — treat schema updates as reviewed artifacts.
6. **Do not commit a default driver** — leave `DatabaseDriver` unset until the DB is chosen; boot throws until then.
7. **ORM-agnostic adapter names** — `item.repository.adapter.ts`, not `mikro-item.repository.ts`.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Driver, env, Nest module / Hono bootstrap | [setup.md](references/setup.md) |
| Entities, mappers, feature binding | [adapters.md](references/adapters.md) |
| `populate`, QueryBuilder, avoiding N+1 | [queries.md](references/queries.md) |
| Migrator / schema workflow | [migrations.md](references/migrations.md) |
| `em.transactional` / Unit of Work | [transactions.md](references/transactions.md) |

## Quick checklist

```text
[ ] Install @mikro-orm/<driver> and export DatabaseDriver from mikro-orm.driver.ts
[ ] Set DATABASE_URL or DB_NAME (+ credentials)
[ ] Uncomment MikroOrmPersistenceModule / createMikroOrm after env is ready
[ ] Decorate infrastructure .../entities/<name>.orm-entity.ts (legacy decorators)
[ ] Use EntityManager in <name>.repository.adapter.ts
[ ] Nest: module + token bind; Hono: await createMikroOrm() in composition root
```

## Anti-patterns

| Don’t | Do instead |
| --- | --- |
| Mikro imports in domain aggregates | Ports + infrastructure entities |
| Hardcode SqliteDriver in the recipe | `mikro-orm.driver.ts` + install matching package |
| `em.find` then per-row `em.find` for children | `populate` / join / batch `IN` query |
| Touch lazy collections after flush without populate | Eager `populate` or explicit load |

## External docs

- https://mikro-orm.io/docs
- https://mikro-orm.io/docs/usage-with-nestjs
