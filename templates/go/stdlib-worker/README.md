# Go stdlib Worker

Lightweight background worker using only the Go Standard Library (`context`, `time.Ticker`, `log/slog`). No HTTP server, no job queue framework.

## Requirements

- Go 1.22+

## Layout

| Path | Role |
| --- | --- |
| `cmd/worker/` | Process entry (`main`, signals) |
| `internal/bootstrap/` | Composition root — wire config, logger, runner |
| `internal/application/worker/` | `Runner` (interval loop) + `Processor` interface |
| `internal/worker/` | Graceful shutdown supervisor |
| `internal/infrastructure/` | Env config + slog setup |

## Setup

```bash
cp .env.example .env   # optional reference only — not auto-loaded
export $(grep -v '^#' .env.example | xargs)   # or export vars manually
make run
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_NAME` | `stdlib-worker` | Log / identity label |
| `APP_ENV` | `development` | Environment label |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `text` | `text` \| `json` |
| `WORKER_INTERVAL` | `30s` | Delay between ticks (`time.ParseDuration`) |
| `WORKER_SHUTDOWN_TIMEOUT` | `10s` | Max wait for in-flight tick after signal |

## Commands

```bash
make run     # go run ./cmd/worker
make test    # go test ./...
make vet     # go vet ./...
make fmt     # gofmt -w .
make build   # go build -o bin/worker ./cmd/worker
```

## Custom processor

1. Implement `worker.Processor` (`Process(ctx context.Context) error`).
2. Replace `ExampleProcessor` in `internal/bootstrap/app.go`.
3. Keep side effects in the processor — do not put business logic in the ticker loop.

## Graceful shutdown

On `SIGINT` / `SIGTERM`:

1. The root context is cancelled.
2. The runner stops scheduling new ticks.
3. The supervisor waits up to `WORKER_SHUTDOWN_TIMEOUT` for the current tick to finish.
4. If the tick does not finish in time, the process returns a timeout error.

## Agent guidance

See [AGENTS.md](AGENTS.md) and [.agents/skills/go-worker/SKILL.md](.agents/skills/go-worker/SKILL.md).
