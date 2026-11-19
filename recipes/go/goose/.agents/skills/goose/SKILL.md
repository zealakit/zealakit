---
name: goose
description: Write and run SQL schema migrations with goose. Use when changing the database schema, adding a migration, or running/rolling back migrations.
---

# goose migrations

## Layout

- `internal/infrastructure/database/migrations/*.sql` — embedded, ordered migrations (`-- +goose Up` / `-- +goose Down`).
- `internal/infrastructure/database/migrate.go` — `database.Migrate(ctx, db, "up"|"down"|"status")`, using the dialect of the selected database recipe.
- `cmd/migrate` — CLI wrapper reading `DATABASE_URL` via `database.Open`.

## Commands

```bash
make migrate-up       # apply all pending migrations
make migrate-down     # roll back the last migration
make migrate-status
```

## Conventions

- One concern per migration; name files `NNNNN_description.sql` and never edit an applied migration — add a new one.
- Always write a working `Down` section.
- Keep SQL portable only when you must; migrations here target the selected database (Postgres or MySQL).
- Run migrations from CI/deploy (`go run ./cmd/migrate up`), not implicitly at application start.
