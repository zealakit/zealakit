# MikroORM setup

## Choose a driver (required before boot)

1. Install one driver package, for example `@mikro-orm/postgresql`, `@mikro-orm/mysql`, or `@mikro-orm/sqlite`.
2. Export it from `mikro-orm.driver.ts`:

```ts
export { PostgreSqlDriver as DatabaseDriver } from "@mikro-orm/postgresql";
```

3. Set connection env: `DATABASE_URL` and/or `DB_NAME` (+ `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` as needed).
4. Options are built in `mikro-orm.options.ts` via `createMikroOrmOptions()`.
5. Nest: `MikroOrmPersistenceModule`. Hono: `createMikroOrm()` from `mikro-orm.bootstrap.ts`.

Scaffold leaves Nest `MikroOrmPersistenceModule` / Hono `createMikroOrm` **commented out** so the app boots without a driver. Uncomment after env + driver are ready.

## Placement

| Artifact | Path |
| --- | --- |
| Nest root module | `infrastructure/persistence/mikro-orm/mikro-orm.module.ts` |
| Hono bootstrap | `infrastructure/persistence/mikro-orm/mikro-orm.bootstrap.ts` |
| Driver export | `infrastructure/persistence/mikro-orm/mikro-orm.driver.ts` |
| Connection options | `infrastructure/persistence/mikro-orm/mikro-orm.options.ts` |
| Feature row models | `infrastructure/persistence/<feature>/entities/*.orm-entity.ts` |
| Repository adapter | `infrastructure/persistence/<feature>/*.repository.adapter.ts` |

## Nest wiring

```typescript
// bootstrap/app.module.ts
imports: [
  MikroOrmPersistenceModule,
  FeatureAModule,
  FeatureBModule,
],
```

`MikroOrmPersistenceModule` uses `MikroOrmModule.forRootAsync` with `createMikroOrmOptions()`. Feature modules may use `MikroOrmModule.forFeature([ItemOrmEntity])` when you want entity-scoped providers; many adapters simply inject `EntityManager`.

## Hono wiring

```typescript
const orm = await createMikroOrm();
const em = orm.em.fork(); // request-scoped fork in HTTP handlers / adapters
```

Always prefer a **forked** `EntityManager` per request/unit of work in long-running Node servers so identity maps do not leak across requests.

## Options notes

Scaffold options include:

- `metadataProvider: ReflectMetadataProvider` (legacy decorators)
- `entities` / `entitiesTs` globs for `*.orm-entity.*`

Import `EntityManager` and driver types from the **driver package** you installed (e.g. `@mikro-orm/postgresql`), matching MikroORM v7 package layout.
