# TypeORM setup

## Choose a driver (required before boot)

1. Install a driver package, for example:
   - Postgres → `pg`
   - MySQL → `mysql2`
   - SQLite → `better-sqlite3`
2. Set env:
   - `DB_TYPE` — TypeORM driver name (`postgres`, `mysql`, `better-sqlite3`, …)
   - `DATABASE_URL` **or** `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
   - optional `DB_SYNCHRONIZE=true` for local only (never in production)
3. Options factory:
   - Nest → `createTypeOrmModuleOptions()` in `typeorm.options.ts`
   - Hono → `createTypeOrmDataSourceOptions()` / `createTypeOrmDataSource()`

Scaffold leaves Nest `TypeormPersistenceModule` / Hono `createTypeOrmDataSource` **commented out** in the composition root so the app boots without a driver. Uncomment after env + driver are ready.

## Placement

| Artifact | Path |
| --- | --- |
| Nest root module | `infrastructure/persistence/typeorm/typeorm.module.ts` |
| Hono DataSource factory | `infrastructure/persistence/typeorm/typeorm.data-source.ts` |
| Connection options | `infrastructure/persistence/typeorm/typeorm.options.ts` |
| Feature row models | `infrastructure/persistence/<feature>/entities/*.orm-entity.ts` |
| Repository adapter | `infrastructure/persistence/<feature>/*.repository.adapter.ts` |
| Nest feature binding | `bootstrap/modules/<feature>.module.ts` |
| Hono feature binding | `bootstrap/modules/<feature>.ts` |

## Nest wiring

```typescript
// bootstrap/app.module.ts
imports: [
  TypeormPersistenceModule,
  FeatureAModule,
  FeatureBModule,
],
```

`TypeormPersistenceModule` calls `TypeOrmModule.forRootAsync` with `createTypeOrmModuleOptions()` (`autoLoadEntities: true`). Feature modules that need repositories import `TypeOrmModule.forFeature([ItemOrmEntity])`.

## Hono wiring

```typescript
const dataSource = await createTypeOrmDataSource().initialize();
// pass dataSource into repository adapters from bootstrap/modules
```

Hono options load entities via glob (`./dist/**/*.orm-entity.js`). Keep that glob in sync with where you place `*.orm-entity.ts`.

## Config notes

- Prefer `DATABASE_URL` when the host provides one string.
- `createTypeOrmModuleOptions` / `createTypeOrmDataSourceOptions` throw if `DB_TYPE` or database name/url is missing — fix env before uncommenting the module.
- Logging: enable TypeORM `logging: ["query", "error"]` in development to spot N+1 (see [queries.md](queries.md)).
