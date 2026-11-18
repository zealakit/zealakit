---
name: docker
description: Build and run this Go service in containers with the multi-stage Dockerfile and compose.yaml. Use when changing the image, adding services, or debugging container startup.
---

# Docker

## Commands

- `docker build -t app .` — build a static binary into a distroless image
- `docker compose up --build` — run the service (plus a `db` service when a database recipe was selected)

## Layout

- `Dockerfile` — builds `./cmd/<entrypoint>` with `CGO_ENABLED=0`, then copies the binary into `distroless/static:nonroot`.
- `compose.yaml` — the `app` service. With `postgres`, `mysql` or `mongodb` it also defines a matching `db` service and passes the connection variables the recipe documents in `.env.example`.

## Conventions

- Configuration comes from environment variables; do not bake secrets into the image.
- Keep `go.sum` committed so image builds are reproducible.
- The distroless image has no shell: debug with `docker compose run --entrypoint sh` on the `build` stage instead.
