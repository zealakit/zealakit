---
name: gin-api
description: >-
  Gin HTTP API conventions for this project: routing, thin handlers, middleware,
  slog, env config, graceful shutdown, and testing with httptest. Use when
  implementing or reviewing Gin API code.
---

# Gin API

This project uses **Gin** for HTTP routing and **Go Standard Library** for logging (`log/slog`), config, and process lifecycle.

## Stack

- Gin engine via `gin.New()` (not `Default`) — custom slog middleware only
- `net/http.Server` for timeouts + graceful shutdown
- `log/slog` for structured logs
- Config from environment variables (see `.env.example` — **not** auto-loaded)

## Layout

| Path | Responsibility |
| --- | --- |
| `cmd/api/` | `main` — signals, bootstrap, exit codes |
| `internal/bootstrap/` | Composition root |
| `internal/infrastructure/config` | Env config |
| `internal/infrastructure/logging` | slog setup |
| `internal/presentation/http/router` | Gin engine + route groups |
| `internal/presentation/http/handler` | Thin handlers |
| `internal/presentation/http/middleware` | Request ID, recovery, logging |
| `internal/presentation/http/response` | JSON helpers |
| `internal/presentation/http/server.go` | `http.Server` wrapper |

## Hard rules

1. Keep Gin (`*gin.Context`, binding, middleware) inside `presentation/http`.
2. Do **not** pass `*gin.Context` into application/domain packages (add those packages only when real business logic appears).
3. Handlers stay thin: bind → call logic → `response.JSON` / `response.Error`.
4. Prefer `response.*` helpers over ad-hoc `c.JSON` for errors.
5. Do not use `gin.Default()` — it duplicates logger/recovery with ours.
6. Set server timeouts from config; shut down with `http.Server.Shutdown`.
7. Tests: `testing` + `httptest` through the Gin engine — no testify unless asked.
8. Before adding a module dependency, justify it.

## Add a route

1. Add a handler under `presentation/http/handler/`.
2. Register it in `presentation/http/router/router.go` (prefer `/api/v1/...` groups).
3. Add an `httptest` test in `router_test.go` (or beside the handler).
4. Run `go test ./...`.

## Commands

```bash
go test ./...
go vet ./...
gofmt -w .
go run ./cmd/api
```
