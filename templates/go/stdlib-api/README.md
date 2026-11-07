# Go stdlib API

Minimal Go HTTP API using only the Standard Library (`net/http`, `log/slog`, `context`), organized with DDD-inspired layers. Framework variants (Gin, etc.) can share the same layering.

## Layout

| Path | Role |
| --- | --- |
| `cmd/api/` | Process entry (`main`) |
| `internal/bootstrap/` | Composition root — wire config, logger, features, server |
| `internal/domain/featurea/` | Sample Item aggregate + repository port |
| `internal/application/featurea/` | CreateItem use case |
| `internal/infrastructure/` | Config, logging, in-memory persistence adapter |
| `internal/presentation/http/` | Handlers, middleware, router, JSON helpers |
| `pkg/` | Optional public libraries (keep empty unless needed) |

## Commands

```bash
make run     # go run ./cmd/api
make test    # go test ./...
make vet     # go vet ./...
make build   # go build -o bin/api ./cmd/api
```

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/hello` → `{ "message": "Hello from Zealakit Go API" }`
- `POST /api/v1/feature-a/items` → `{ "id", "name" }` (`201`) — sample feature slice

```bash
curl -s -X POST localhost:8080/api/v1/feature-a/items \
  -H 'content-type: application/json' \
  -d '{"name":"Widget"}'
```

## Configuration

See `.env.example`. Variables are read from the process environment (no automatic `.env` loading).

## Agent guidance

See [AGENTS.md](AGENTS.md) and [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md).
