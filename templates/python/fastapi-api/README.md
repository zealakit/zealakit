# FastAPI API

Minimal FastAPI service organized with DDD-inspired layers (same shape as the Node and Go API templates).

## Layout

| Path | Role |
| --- | --- |
| `src/app/main.py` | ASGI entry (`app`) |
| `src/app/bootstrap/` | Composition root and settings |
| `src/app/domain/feature_a/` | Sample `Item` entity + repository port |
| `src/app/application/feature_a/` | `CreateItem` use case |
| `src/app/infrastructure/` | In-memory persistence adapter |
| `src/app/presentation/http/` | Routers (`/health`, `/api/v1/...`) |
| `tests/` | pytest suite (domain, use case, HTTP) |

## Commands

```bash
uv sync                                               # install
uv run uvicorn app.main:app --reload --app-dir src    # run (http://localhost:8000/docs)
uv run pytest                                         # test
uv run ruff check . && uv run ruff format --check .   # lint
```

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /api/v1/feature-a/items` → `{ "id", "name" }` (`201`)

Configuration comes from environment variables (see `.env.example`).
