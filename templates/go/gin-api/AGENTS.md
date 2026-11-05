# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write idiomatic Gin + Go HTTP code**.

## Always follow

- **Gin API:** [.agents/skills/gin-api/SKILL.md](.agents/skills/gin-api/SKILL.md) — routing, handlers, middleware, config, slog, shutdown
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `cmd/api/main.go`. Composition root: `internal/bootstrap`. Module path comes from `go.mod` (rewritten at scaffold time).

This is a **Gin** HTTP API — keep framework types in the presentation layer. Do **not** add databases, auth frameworks, or queue systems unless the user explicitly asks.
