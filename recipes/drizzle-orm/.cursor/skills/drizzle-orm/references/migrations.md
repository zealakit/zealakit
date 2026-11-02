# Drizzle migrations (drizzle-kit)

Schema changes go through **drizzle-kit**, not ad-hoc production SQL.

Recipe scripts (after env is set):

```bash
pnpm db:generate   # drizzle-kit generate
pnpm db:migrate    # drizzle-kit migrate
pnpm db:studio     # drizzle-kit studio
```

`drizzle.config.ts` requires:

- `DB_DIALECT` — `postgresql` | `mysql` | `sqlite` | …
- `DATABASE_URL`
- `schema` → `./src/infrastructure/persistence/drizzle/schema.ts`
- `out` → `./src/infrastructure/persistence/drizzle/migrations`

## Workflow

1. Edit `schema.ts` (and relations if any).
2. `pnpm db:generate` — review the SQL under `migrations/`.
3. Apply with `pnpm db:migrate` in each environment (local → staging → prod).
4. Commit both schema and generated migration files.

## Practices

- Never skip reviewing generated SQL for drops/renames.
- Prefer additive migrations; split destructive renames into backfill steps when data exists.
- Keep kit `dialect` matched to the `*-core` imports in `schema.ts` and the runtime driver in `drizzle.client.ts`.
- Do not maintain a parallel hand-written migration system alongside drizzle-kit for the same tables.

## Local spikes

You may push schema with kit `push` during empty-db experiments if you add that script — treat it like synchronize: not for production.

Docs: https://orm.drizzle.team/docs/kit-overview
