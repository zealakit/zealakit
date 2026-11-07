---
name: mysql
description: >-
  MySQL connectivity for this Go service using database/sql and the
  go-sql-driver/mysql driver. Use when wiring the pool, adding queries, or
  handling database lifecycle. No ORM.
---

# MySQL (database/sql + go-sql-driver/mysql)

The recipe provides `internal/infrastructure/database`:

```go
db, err := database.Open(ctx)
if err != nil {
	return nil, fmt.Errorf("open database: %w", err)
}
defer db.Close()
```

## Configuration

`database.ConfigFromEnv()` reads:

| Variable | Required | Default |
| --- | --- | --- |
| `DATABASE_URL` | yes | — |
| `DB_MAX_OPEN_CONNS` | no | `10` |
| `DB_MAX_IDLE_CONNS` | no | `5` |
| `DB_CONN_MAX_LIFETIME` | no | `30m` |
| `DB_CONNECT_TIMEOUT` | no | `5s` |

`DATABASE_URL` is a MySQL DSN, for example:

```text
user:password@tcp(localhost:3306)/app?parseTime=true&charset=utf8mb4&loc=UTC
```

`Open` pings the database before returning. If ping fails, the pool is closed.

## Lifecycle

- Create the pool once in `internal/bootstrap` (composition root).
- Pass `*sql.DB` to infrastructure adapters; do not use a package-level global.
- Close it on shutdown, after the HTTP server/worker stops.
- Keep `database.Open` out of handlers and tests that do not need a real DB.

## Queries

- Prefer explicit SQL in the infrastructure adapter that owns the resource.
- Always pass `context.Context` and check errors.
- Use `QueryRowContext(...).Scan(...)`; handle `sql.ErrNoRows` explicitly.
- Use parameters (`?`) — never concatenate user input.
- Set `parseTime=true` in the DSN when scanning `DATETIME`/`TIMESTAMP` into `time.Time`.
- Do not add an ORM or a generic repository abstraction for a single use case.

## Tests

`database.ConfigFromEnv` has no network dependency. Tests that need a real
MySQL instance should be opt-in (build tag or env guard) and are not part of
`go test ./...` by default.
