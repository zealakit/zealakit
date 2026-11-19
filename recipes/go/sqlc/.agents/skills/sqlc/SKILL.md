---
name: sqlc
description: Generate type-safe Go from SQL with sqlc. Use when adding queries, changing the schema used by queries, or regenerating code.
---

# sqlc

## Layout

- `sqlc.yaml` — engine and output settings (generated for the selected database; uses `database/sql`).
- `db/schema/schema.sql` — the schema sqlc reads. Keep it in sync with your migrations.
- `db/queries/*.sql` — annotated queries (`-- name: GetExample :one`).
- `internal/infrastructure/persistence/sqlc/` — generated code (commit it).

## Commands

```bash
# install once: https://docs.sqlc.dev/en/stable/overview/install.html
make sqlc          # sqlc generate
make sqlc-vet      # sqlc vet
```

## Conventions

- Write queries in `.sql`, never edit generated files.
- Wrap `*sql.DB` from `database.Open` with `sqlc.New(db)` in the composition root and inject the `Querier` into application adapters.
- One query file per aggregate; name queries `Verb+Noun` and use `:one`, `:many`, `:exec`.
- Run `sqlc generate` after every schema or query change and commit the result.
