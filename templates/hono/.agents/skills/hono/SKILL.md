---
name: hono
description: >-
  Hono conventions for routes, middleware, Node adapter, error mapping, and
  testing. Use when building, reviewing, or refactoring Hono backends —
  alongside structure-ddd for folder layout and typescript/javascript for
  language rules.
---

# Hono

**Clarity and explicit composition beat framework magic.** Prefer thin routes, constructor wiring in bootstrap, and Web Standards APIs.

Aligns with [typescript](../typescript/SKILL.md) and [javascript](../javascript/SKILL.md). For `src/` layout and layer rules, follow [structure-ddd](../structure-ddd/SKILL.md).

## Critical rules

1. **Feature route factories** — one `presentation/.../<feature>.routes.ts` + `bootstrap/modules/<feature>.ts` per bounded context. Source files stay **layer-first** per [structure-ddd](../structure-ddd/SKILL.md).
2. **Composition root in bootstrap** — construct adapters/handlers only in `bootstrap/`; never `new Adapter()` inside route files.
3. **Constructor injection** — handlers take ports as constructor args; no service locator in business code.
4. **Routes are adapters** — map HTTP ↔ application use cases; no business logic.
5. **Validate at the edge** — parse/validate request bodies in presentation; map domain errors to HTTP status there.
6. **Version via path prefix** — mount with `app.route("/api/v1/<feature>", routes)`.
7. **Repository ports in domain/application** — implementations live in infrastructure.
8. **Test with `app.request()`** — Web Fetch API against `createApp()`; mock ports by swapping factories in tests when needed.
9. **Config at the edge** — keep `process.env` out of domain; read env in bootstrap/infrastructure factories.
10. **Node adapter** — `serve({ fetch: app.fetch, port })` from `@hono/node-server` in `main.ts`.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Routing, mounting, context | [routing.md](references/routing.md) |
| Middleware & errors | [middleware-and-errors.md](references/middleware-and-errors.md) |
| Testing with `app.request` | [testing.md](references/testing.md) |

## Application

When **writing** Hono code:

- Keep Hono imports in presentation / bootstrap, not in pure domain entities.
- Prefer small `Hono` sub-apps per feature, mounted from `create-app.ts`.
- Follow [structure-ddd](../structure-ddd/SKILL.md) for where files live.

When **reviewing**:

- Flag business logic in routes, adapters constructed outside bootstrap, and infrastructure leaking into domain.

## External docs

- https://hono.dev
- https://hono.dev/docs/getting-started/nodejs
- https://hono.dev/docs/guides/testing
