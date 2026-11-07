# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write idiomatic Go worker code**.

## Always follow

- **Worker:** [.agents/skills/go-worker/SKILL.md](.agents/skills/go-worker/SKILL.md) — ticker runner, Processor, config, slog, graceful shutdown
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `cmd/worker/main.go`. Composition root: `internal/bootstrap`. Module path comes from `go.mod` (rewritten at scaffold time).

This is a **Go Standard Library worker** — do **not** add HTTP servers, job queues, cron libraries, or third-party frameworks unless the user explicitly asks.
