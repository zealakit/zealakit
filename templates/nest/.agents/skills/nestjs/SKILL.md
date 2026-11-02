---
name: nestjs
description: >-
  NestJS conventions for modules, DI, testing, security, and API design. Use when
  building, reviewing, or refactoring NestJS backends — alongside structure-ddd
  for folder layout and typescript/javascript for language rules. Persistence
  (N+1, migrations, transactions) lives in the installed ORM recipe skill
  (type-orm, mikro-orm, or drizzle-orm), not here.
---

# NestJS

**Clarity and explicit boundaries beat clever NestJS magic.** Prefer feature modules, constructor injection, and thin controllers.

Aligns with [typescript](../typescript/SKILL.md) and [javascript](../javascript/SKILL.md). For `src/` layout and layer rules, follow [structure-ddd](../structure-ddd/SKILL.md).

## Critical rules

1. **Feature Nest modules** — one `bootstrap/modules/<feature>.module.ts` per bounded context. Source files stay **layer-first** per [structure-ddd](../structure-ddd/SKILL.md).
2. **No circular module imports** — extract shared modules or use domain events.
3. **Constructor injection only** — no service locator (`ModuleRef.get` in business code).
4. **Interfaces via injection tokens** — bind domain ports in infrastructure.
5. **Single-responsibility services** — split orchestration (application) from domain rules.
6. **Controllers are adapters** — map HTTP ↔ application use cases; no business logic.
7. **Validate at the edge** — DTOs + pipes for input; throw Nest HTTP exceptions at presentation or map domain errors there.
8. **Repository ports in domain/application** — implementations live in infrastructure.
9. **Test with `TestingModule`** — mock ports, not Nest internals; e2e with Supertest.
10. **Config via `ConfigModule`** — no scattered `process.env` in domain code.

## Persistence

This Nest skill stays **ORM-agnostic**. Persistence guidance (setup, adapters, N+1, migrations, transactions) ships with the exclusive ORM recipe under `.agents/skills/<orm>/SKILL.md`:

- TypeORM → `.agents/skills/type-orm/SKILL.md`
- MikroORM → `.agents/skills/mikro-orm/SKILL.md`
- Drizzle → `.agents/skills/drizzle-orm/SKILL.md`

If none of those skills exist, no ORM recipe is installed yet — keep the in-memory adapter until one is chosen.

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Modules, SRP, events, repository pattern | [architecture.md](references/architecture.md) |
| Constructor injection, scopes, tokens, ISP/LSP | [dependency-injection.md](references/dependency-injection.md) |
| Async errors, HTTP exceptions, filters | [error-handling.md](references/error-handling.md) |
| JWT, guards, rate limit, XSS, validation | [security.md](references/security.md) |
| Lifecycle hooks, lazy modules, caching, queries | [performance.md](references/performance.md) |
| Unit TestingModule, mocks, e2e Supertest | [testing.md](references/testing.md) |
| DTOs, serialization, interceptors, pipes, versioning | [api-design.md](references/api-design.md) |
| Health, message/event patterns, queues | [microservices.md](references/microservices.md) |
| Graceful shutdown, config, structured logging | [devops.md](references/devops.md) |

## Application

When **writing** NestJS code:

- Put Nest decorators in presentation / infrastructure adapters, not in pure domain entities.
- Export only what other modules need; keep providers private by default.
- Follow [structure-ddd](../structure-ddd/SKILL.md) for where files live.

When **reviewing**:

- Flag circular modules, business logic in controllers, `any` providers, and infrastructure leaking into domain.

## External docs

- https://docs.nestjs.com
- https://docs.nestjs.com/fundamentals/custom-providers
- https://docs.nestjs.com/pipes
