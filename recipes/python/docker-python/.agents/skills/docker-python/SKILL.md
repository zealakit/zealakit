---
name: docker-python
description: Build and run this Python service in containers with the multi-stage Dockerfile and compose.yaml.
---

# Docker

- `docker build -t app .` — uv-based multi-stage build, runs as a non-root user.
- `docker compose up --build` — the app (plus a `db` service when `postgres-python` is selected).

## Conventions

- Dependencies come from `pyproject.toml` (`uv sync --no-dev`); commit `uv.lock` so images are reproducible.
- Configuration through environment variables only; never bake secrets into the image.
