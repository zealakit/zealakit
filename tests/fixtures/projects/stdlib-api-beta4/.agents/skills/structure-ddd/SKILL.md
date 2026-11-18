---
name: structure-ddd
description: >-
  Hexagonal / Clean Architecture layout for this Go API: domain, application,
  presentation, infrastructure, bootstrap. Use when scaffolding features,
  placing files under internal/, wiring the composition root, or reviewing
  layer boundaries.
---

# Structure DDD (Hexagonal) — Go

**Organize by architectural layer first, feature second.** Do not invent a parallel `internal/features/*` tree.

Aligns with [go-stdlib](../go-stdlib/SKILL.md) for HTTP and tooling.

## Critical rules

1. **Layer-first paths** — features appear under each layer they need (`internal/domain/<feature>/`, `internal/application/<feature>/`, …).
2. **Dependency direction** — `presentation → application → domain ← infrastructure`. Domain has **zero** `net/http` / DB / framework imports.
3. **Features do not import each other** — cross-feature work goes through application ports or domain events.
4. **Composition root only in bootstrap / cmd** — construct concrete adapters and handlers in `internal/bootstrap` (called from `cmd/api`).
5. **Handlers stay thin** — decode HTTP → call application use case → encode HTTP; no business rules in presentation.
6. **Interfaces near consumers** — define ports where they are used (often application or domain); implement them in infrastructure.
7. **Avoid empty abstractions** — do not add repository interfaces until there is real persistence.
8. **`pkg/` is public API only** — prefer `internal/` for app code.
9. **Inspect existing code before adding files** — reuse handlers, middleware, and utilities; do not duplicate.
10. **No third-party web frameworks** — stay on `net/http` unless the user explicitly requests otherwise.

## Top-level layout

| Folder | Responsibility |
| --- | --- |
| `cmd/api/` | `main` — signals, call bootstrap, exit codes |
| `internal/domain/` | Entities, VOs, domain events, repository **ports** |
| `internal/application/` | Use cases / commands / queries |
| `internal/presentation/http/` | Handlers, middleware, router, JSON helpers |
| `internal/infrastructure/` | Config, logging, future adapters |
| `internal/bootstrap/` | Wire dependencies; build `App` |
| `pkg/` | Optional reusable public packages |

Entry: `cmd/api/main.go`.

## Dependency map

```text
presentation ──► application ──► domain
                      ▲             ▲
                      │             │
bootstrap (compose) ──┘             │
infrastructure ─────────────────────┘
```

## Scaffold a new feature (checklist)

```text
- [ ] internal/domain/<feature>/ … ports + entities as needed
- [ ] internal/application/<feature>/ … use case / service
- [ ] internal/presentation/http/handler/ … thin handlers
- [ ] Register routes in presentation/http/router.go
- [ ] Wire constructors in internal/bootstrap
- [ ] Add table-driven tests with net/http/httptest
- [ ] No imports from other features' infrastructure
```

## Progressive disclosure

- [folder-layout.md](references/folder-layout.md)
- [layer-rules.md](references/layer-rules.md)
- [composition-root.md](references/composition-root.md)
- [feature-a-walkthrough.md](references/feature-a-walkthrough.md)
- [add-endpoint.md](references/add-endpoint.md)
