# MikroORM migrations

Prefer the **Migrator** for shared/dev/prod schema changes. Avoid relying on `SchemaGenerator` sync against production databases.

## Workflow (typical)

1. Change `*.orm-entity.ts` under infrastructure.
2. Generate a migration with the MikroORM CLI (add scripts when you adopt them), pointing at the same options as `createMikroOrmOptions()`.
3. Review SQL in the generated migration.
4. Run migrations in CI/deploy before or as part of release.

Example script names (project-specific):

```bash
pnpm mikro-orm migration:create
pnpm mikro-orm migration:up
pnpm mikro-orm migration:down
```

Keep migration files under `infrastructure/persistence/mikro-orm/migrations/` (or a clear infra path), never under `domain/`.

## Practices

- Implement reversible migrations when the change allows it.
- Use multi-step renames (add → backfill → drop) for columns with data.
- Do not mix ad-hoc production SQL with the migrator history.
- Snapshot / dump local DB before applying risky migrations during development.

## SchemaGenerator (local only)

`SchemaGenerator` update/create can speed up spike work on empty local DBs. Treat it like TypeORM `synchronize`: fine for throwaway sandboxes, not for production.

Docs: https://mikro-orm.io/docs/migrations
