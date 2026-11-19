# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write idiomatic Go + DDD-layered code**.

## Always follow

- **Structure:** [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md) — hexagonal layers, composition root, feature placement
- **Database:** `.agents/skills/postgres/SKILL.md` — PostgreSQL pool via `database/sql` + pgx; no ORM. Run `go mod tidy` once after scaffolding.
- **Go stdlib HTTP:** [.agents/skills/go-stdlib/SKILL.md](.agents/skills/go-stdlib/SKILL.md) — `net/http`, middleware, config, slog, testing
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `cmd/api/main.go`. Composition root: `internal/bootstrap`. Module path comes from `go.mod` (rewritten at scaffold time).

This is a **Go Standard Library** project — do **not** introduce Gin, Fiber, Echo, Chi, or other web frameworks unless the user explicitly asks.
