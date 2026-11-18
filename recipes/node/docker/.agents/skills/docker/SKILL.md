---
name: docker
description: Build and run this app in containers with the multi-stage Dockerfile and compose.yaml. Use when changing the image, adding services, or debugging container startup.
---

# Docker

## Commands

- `docker build -t app .` — build the production image
- `docker compose up --build` — run the app (and its database service when one was generated)

## Layout

- `Dockerfile` — `deps` → `build` → slim `runtime` stage running as the unprivileged `node` user. It uses `npm`; if the project uses pnpm/yarn/bun, swap the install lines (`corepack enable` + `pnpm install --frozen-lockfile`) and copy that lockfile.
- `.dockerignore` — keeps `node_modules`, build output and `.env*` out of the build context.
- `compose.yaml` — the `app` service on port 3000. With an ORM recipe selected it also defines a `db` service (Postgres by default) and passes `DATABASE_URL` to the app.

## Conventions

- Configuration comes from environment variables; never bake secrets into the image or commit `.env`.
- Keep the runtime stage free of dev dependencies and source files.
- Next.js uses `output: "standalone"`; Nuxt runs the Nitro `.output` server.
- Change the database engine by editing the `db` image and the `DATABASE_URL` scheme together.
- ORM clients that need a generate step (for example Prisma) must run it in the `build` stage.
