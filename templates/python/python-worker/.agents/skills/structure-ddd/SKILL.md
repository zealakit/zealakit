---
name: structure-ddd
description: >-
  Layer layout for this Python worker: domain, application, infrastructure,
  bootstrap. Use when adding jobs, adapters or wiring the composition root.
---

# Structure DDD (hexagonal) — worker

`src/app/<layer>/<feature>/`; dependency direction `application → domain ← infrastructure`.

| Folder | Responsibility |
| --- | --- |
| `main.py` | Entry: logging, signal handlers, run |
| `worker.py` | The scheduling loop |
| `bootstrap/` | Settings + composition root |
| `application/` | Use cases (what a tick does) |
| `domain/` | Entities and ports (add when needed) |
| `infrastructure/` | Adapters (queues, HTTP clients, stores) |

Only `bootstrap/container.py` builds concrete adapters. Add a port before adding a second adapter.
