---
name: go-worker
description: >-
  Go Standard Library background worker conventions: ticker runner, Processor
  interface, context cancellation, graceful shutdown, env config, and slog.
  Use when implementing or reviewing worker code in this project.
---

# Go Standard Library Worker

This project is a **background worker** using only the Go Standard Library.
It is **not** an HTTP API — do not add `net/http` servers unless the user explicitly asks.

## Stack

- `cmd/worker` — process entry (`signal.NotifyContext`)
- `internal/bootstrap` — composition root
- `internal/application/worker` — `Runner` + `Processor`
- `internal/worker` — graceful shutdown supervisor
- `internal/infrastructure/config` + `logging` — env config and `log/slog`
- Config from environment variables (see `.env.example` — **not** auto-loaded)

## Hard rules

1. Prefer `context.Context` for cancellation; use `signal.NotifyContext` in `main`.
2. Implement work in a `Processor`; keep `Runner` free of business side effects.
3. Do not overlap ticks — wait for `Process` to finish before the next interval.
4. Treat `context.Canceled` / `DeadlineExceeded` as normal shutdown, not failure.
5. Honor `WORKER_SHUTDOWN_TIMEOUT` — never wait forever on stop.
6. Tests: `testing` only — no testify/ginkgo unless the user asks.
7. Before adding a module dependency, justify it; default answer is **stdlib**.
8. Do not add queues, cron libraries, Redis, Kafka, or HTTP frameworks by default.

## Lifecycle

```text
main
  → bootstrap.New (config, logger, runner)
  → signal.NotifyContext
  → App.Run
       → worker.Run (supervisor)
            → Runner.Run (ticker loop → Processor.Process)
  → cancel on SIGINT/SIGTERM
  → wait ≤ ShutdownTimeout for in-flight tick
```

## Commands

```bash
go test ./...
go vet ./...
gofmt -w .
go run ./cmd/worker
```

## Extending

1. Add a new type implementing `worker.Processor`.
2. Wire it in `internal/bootstrap/app.go` instead of `ExampleProcessor`.
3. Keep domain logic out of `cmd/` and out of the ticker loop.
4. Inspect existing packages before adding duplicates.
