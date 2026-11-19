# Python worker

Minimal asyncio background worker with graceful shutdown, organized with the same DDD-inspired layers as the Python API template.

## Layout

| Path | Role |
| --- | --- |
| `src/app/main.py` | Process entry: logging, signals, run the worker |
| `src/app/bootstrap/` | Settings and composition root |
| `src/app/application/` | `ProcessTick` use case (one unit of work) |
| `src/app/worker.py` | The loop: run a tick every interval until stopped |
| `tests/` | pytest suite |

## Commands

```bash
uv sync
uv run python -m app.main     # run (Ctrl+C or SIGTERM stops it cleanly)
uv run pytest
uv run ruff check .
```

Configuration comes from environment variables (see `.env.example`).
