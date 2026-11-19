---
name: structure-ddd
description: >-
  Hexagonal / Clean Architecture layout for this FastAPI service: domain,
  application, presentation, infrastructure, bootstrap. Use when adding
  features, placing files, wiring the composition root, or reviewing layers.
---

# Structure DDD (hexagonal) — Python

**Layer first, feature second**: `src/app/<layer>/<feature>/`.

## Rules

1. Dependency direction: `presentation → application → domain ← infrastructure`.
2. `domain/` imports only the standard library (dataclasses, typing, abc).
3. Features do not import each other's infrastructure; cross-feature work goes through application ports.
4. Only `bootstrap/` builds concrete adapters (`container.py`).
5. Routers stay thin: no business rules in `presentation/`.
6. Define ports (`Protocol` / ABC) next to their consumer; implement them in `infrastructure/`.
7. Inspect existing modules before adding new ones.

## Layout

| Folder | Responsibility |
| --- | --- |
| `src/app/main.py` | Create the FastAPI app, include routers |
| `src/app/bootstrap/` | Settings + composition root |
| `src/app/domain/<feature>/` | Entities, value objects, repository ports |
| `src/app/application/<feature>/` | Use cases |
| `src/app/infrastructure/` | Adapters (persistence, clients) |
| `src/app/presentation/http/` | Routers, request/response models |

## New feature checklist

```text
- [ ] domain/<feature>/: entity + port
- [ ] application/<feature>/: use case
- [ ] infrastructure/persistence/<feature>/: adapter
- [ ] presentation/http/api/v1/<feature>.py: router
- [ ] bootstrap/container.py: wire it
- [ ] tests/: domain, use case, HTTP
```
