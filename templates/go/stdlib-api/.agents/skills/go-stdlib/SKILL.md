---
name: go-stdlib
description: >-
  Go Standard Library HTTP API conventions for this project: net/http ServeMux,
  middleware, slog, env config, graceful shutdown, and testing with httptest.
  Use when implementing handlers or reviewing Go API code — alongside structure-ddd.
---

# Go Standard Library HTTP

This project uses **only** the Go Standard Library for HTTP and logging.

## Stack

- `net/http` + Go 1.22+ method-aware `ServeMux` patterns (`GET /path`)
- `log/slog` for structured logs
- `context` for cancellation and graceful shutdown
- `encoding/json` via small helpers in `presentation/http`
- Config from environment variables (see `.env.example` — **not** auto-loaded)

## Hard rules

1. Prefer `http.Server` with explicit timeouts (`ReadTimeout`, `WriteTimeout`, `IdleTimeout`).
2. Register routes in `presentation/http/router.go`; keep handlers in `handler/`.
3. Middleware: request id → recovery → logging (order matters; see `server.go`).
4. Return JSON with `respond.JSON` / `respond.ErrorJSON` — do not scatter `Encode` calls.
5. Propagate `context.Context`; never store request-scoped data in globals.
6. Tests: `testing` + `net/http/httptest` — no testify/ginkgo unless the user asks.
7. Before adding a module dependency, justify it; default answer is **stdlib**.

## Commands

```bash
go test ./...
go vet ./...
gofmt -w .
go run ./cmd/api
```

## Errors

- Map domain/application errors to HTTP in presentation.
- Log unexpected failures with slog; avoid leaking internals in JSON bodies.
