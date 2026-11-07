---
name: structure-ddd
description: >-
  Hexagonal / Clean Architecture layout for this Hono repo: domain,
  application, presentation, infrastructure, shared, bootstrap. Use when
  scaffolding features, placing files under src/, wiring composition-root
  ports/adapters, reviewing layer boundaries, or when the user mentions DDD,
  hexagonal, clean architecture, feature-a/feature-b, or repository adapters.
---

# Structure DDD (Hexagonal)

**This repo organizes by architectural layer first, feature second.** Do not invent a parallel `src/features/*` tree.

Aligns with [hono](../hono/SKILL.md) for HTTP wiring, [typescript](../typescript/SKILL.md) / [javascript](../javascript/SKILL.md) for language rules.

Canonical example in the codebase: `feature-a` (Create Item flow).

## Critical rules

1. **Layer-first paths** — every feature appears under each layer it needs (`domain/<feature>/`, `application/<feature>/`, …).
2. **Dependency direction** — `presentation → application → domain ← infrastructure`. Domain has **zero** Hono/ORM/HTTP imports.
3. **Features do not import each other** — cross-feature work goes through application ports or domain events, never direct adapter/handler imports.
4. **kebab-case files & folders** — e.g. `create-item.command.ts`, `item.repository.adapter.ts`, `feature-a.ts`.
5. **Ports vs adapters** — repository **ports** live in `domain/.../repositories/` (+ application `ports/output/` re-export). **Adapters** live only in `infrastructure/`.
6. **ORM-agnostic adapter names** — prefer `*.repository.adapter.ts` / `ItemRepositoryAdapter`, not `typeorm-*` / `mikro-*`.
7. **Port tokens in application** — `application/<feature>/tokens/<feature>.tokens.ts` with `Symbol.for(...)` for documentation; wire concrete adapters in `bootstrap/modules/<feature>.ts`.
8. **Composition root only in bootstrap** — `main.ts`, `create-app.ts`, `container.ts`, and per-feature factories live under `bootstrap/`.
9. **Routes stay thin** — map HTTP body → command/query → handler; no domain rules in presentation.
10. **`shared/` is non-business** — constants, pure types, utils only. No use-cases, no entities, no framework providers that encode policy.

## Top-level `src/`

| Folder | Responsibility |
| --- | --- |
| `domain/` | Aggregates, entities, VOs, domain events, repository **ports** |
| `application/` | Commands/queries, handlers, DTOs, mappers, ports, port tokens |
| `presentation/` | HTTP routes/webhooks, request/response DTOs, middleware |
| `infrastructure/` | Persistence/cache/messaging/HTTP clients/security **adapters** |
| `shared/` | Cross-cutting pure helpers (no business policy) |
| `bootstrap/` | `main.ts`, `create-app.ts`, `container.ts`, per-feature factories |

Entry: `src/bootstrap/main.ts` (`@hono/node-server`).

## Dependency map

```text
presentation ──► application ──► domain
                      ▲             ▲
                      │             │
bootstrap (compose) ──┘             │
infrastructure ─────────────────────┘
```

- Domain never imports application, presentation, infrastructure, or Hono.
- Application may import domain only (handlers take constructor deps typed as ports).
- Infrastructure may import domain (to implement ports) and map to persistence models.
- Presentation may import application (handlers/commands) — not infrastructure adapters.
- Bootstrap imports all layers to wire the composition root.

## Scaffold a new feature (checklist)

```text
Feature scaffold:
- [ ] domain/<feature>/{aggregates,value-objects,events,repositories,entities}
- [ ] application/<feature>/{commands,queries,handlers,dtos,mappers,tokens,ports/{input,output}}
- [ ] presentation/http/api/v1/<feature>/{dto,docs} + <feature>.routes.ts
- [ ] infrastructure/persistence/<feature>/{entities,mappers} + <entity>.repository.adapter.ts
- [ ] bootstrap/modules/<feature>.ts — construct adapters + handlers; export route factory
- [ ] Mount routes in bootstrap/create-app.ts; register deps in container.ts
- [ ] No imports from other features' infrastructure or handlers
```

Minimal create-flow files (mirror `feature-a`):

1. VO + Aggregate (+ optional domain event)
2. `repositories/<thing>.repository.ts` (port)
3. `ports/output/<thing>.repository.port.ts` (re-export)
4. `tokens/<feature>.tokens.ts`
5. Command + Handler
6. HTTP routes + response DTO
7. Persistence entity + mapper + `*.repository.adapter.ts`
8. Feature factory: `new Adapter()` → `new Handler(adapter)` → routes

## Naming cheatsheet

| Kind | Pattern | Example |
| --- | --- | --- |
| Feature folder | kebab-case | `feature-a` |
| Aggregate | `<name>.aggregate.ts` | `item.aggregate.ts` |
| Value object | `<name>.vo.ts` | `item-id.vo.ts` |
| Domain event | `<past-tense>.event.ts` | `item-created.event.ts` |
| Repository port | `<name>.repository.ts` | `item.repository.ts` |
| App output port | `ports/output/<name>.repository.port.ts` | `item.repository.port.ts` |
| Command / handler | `create-<name>.command.ts` / `create-<name>.handler.ts` | |
| HTTP DTO | `<action>.request.dto.ts` / `<name>.response.dto.ts` | |
| Persistence model | `<name>.orm-entity.ts` | ORM-neutral “row” model |
| Repository adapter | `<name>.repository.adapter.ts` | `ItemRepositoryAdapter` |
| Feature factory | `bootstrap/modules/<feature>.ts` | `createFeatureA` |
| Port token map | `FEATURE_X_TOKENS` | `FEATURE_A_TOKENS.ITEM_REPOSITORY` |

## Anti-patterns

- Business logic in route handlers or ORM entities
- Importing `infrastructure/**` from `domain/**` or `application/**` handlers
- Naming adapters after a vendor (`typeorm-item.repository.ts`) when the port is ORM-agnostic
- Putting composition factories under `domain/` or `application/`
- Shared kernel that grows into a junk drawer of use-cases
- Feature B importing Feature A’s `ItemRepositoryAdapter` or handler class

## Progressive disclosure

| Topic | Reference |
| --- | --- |
| Full folder tree + file placement | [folder-layout.md](references/folder-layout.md) |
| Per-layer allow/deny imports | [layer-rules.md](references/layer-rules.md) |
| Composition root & port wiring | [composition-root.md](references/composition-root.md) |
| End-to-end feature-a walkthrough | [feature-a-walkthrough.md](references/feature-a-walkthrough.md) |

## When reviewing PRs

- [ ] New files sit in the correct layer/feature folder
- [ ] Domain stays framework-free
- [ ] Ports are interfaces/types; adapters live in infrastructure
- [ ] Concrete adapters constructed only in `bootstrap/modules/*`
- [ ] No cross-feature concrete imports
- [ ] File names are kebab-case and match the cheatsheet
