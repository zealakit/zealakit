# Go Gin API

Production-conscious REST API starter using [Gin](https://github.com/gin-gonic/gin), with `log/slog`, env-based config, and graceful shutdown via `net/http.Server`.

## Requirements

- Go 1.22+

## Layout

| Path | Role |
| --- | --- |
| `cmd/api/` | Process entry (`main`, signals) |
| `internal/bootstrap/` | Composition root |
| `internal/infrastructure/` | Config + slog |
| `internal/presentation/http/` | Gin router, handlers, middleware, responses, server |

No empty `domain/` / `application/` packages — add them when real business logic appears.

## Setup

```bash
go mod tidy
make run
```

Environment variables are documented in `.env.example` (not auto-loaded).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_NAME` | `gin-api` | Log / identity label |
| `APP_ENV` | `development` | Environment label |
| `APP_HOST` | `0.0.0.0` | Listen host |
| `APP_PORT` | `8080` | Listen port |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `text` | `text` \| `json` |
| `SERVER_READ_TIMEOUT` | `10s` | `http.Server.ReadTimeout` |
| `SERVER_WRITE_TIMEOUT` | `10s` | `http.Server.WriteTimeout` |
| `SERVER_IDLE_TIMEOUT` | `60s` | `http.Server.IdleTimeout` |
| `SERVER_SHUTDOWN_TIMEOUT` | `10s` | Max graceful shutdown wait |

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/hello` → `{ "message": "..." }` (optional `?name=`)

## Commands

```bash
make run     # go run ./cmd/api
make test    # go test ./...
make vet     # go vet ./...
make fmt     # gofmt -w .
make build   # go build -o bin/api ./cmd/api
```

## Adding routes

1. Create a thin handler in `internal/presentation/http/handler/`.
2. Register it in `internal/presentation/http/router/router.go` under `/api/v1` when versioned.
3. Return JSON via `response.JSON` / `response.Error`.
4. Cover with `httptest` tests.

## Middleware

Baseline stack (order matters): request ID → recovery → logging.

Do not call `gin.Default()` — it would duplicate logger/recovery.

## Graceful shutdown

On `SIGINT` / `SIGTERM`, the process cancels the root context and `http.Server.Shutdown` runs with `SERVER_SHUTDOWN_TIMEOUT`.

## Agent guidance

See [AGENTS.md](AGENTS.md) and [.agents/skills/gin-api/SKILL.md](.agents/skills/gin-api/SKILL.md).
