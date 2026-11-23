---
layout: worker
required:
  - Requirements
  - Getting started
  - Jobs
  - Configuration
  - Operations
  - Agent docs
  - License
recipeSections:
  - Database
  - Docker
  - Testing
  - CI
---

# Worker layout

Background worker, scheduler or queue consumer.

1. **H1** — unit name plus a tagline that names the work it performs.
2. **Requirements** — runtime version, external services (broker, database).
3. **Getting started** — run locally with the local dependency (compose or a
   documented stub), one command per step.
4. **Jobs** — table: job name → trigger (schedule/queue) → retries → what it
   does. The handler files are the fact source.
5. **Configuration** — table: key → default → required → description. This
   replaces the `Environment` section; keys still match `.env.example`.
6. **Recipe sections** — only the ones in `profile.sections`, in the order
   `recipeSections` lists.
7. **Operations** — start/stop, graceful shutdown, signals, logs, metrics,
   failure recovery. Short; no deployment tutorial.
8. **Agent docs** — link `AGENTS.md` / `.agents/skills`.
9. **License**.

There is no API section: the worker has no HTTP surface unless a recipe adds
one, in which case document it under Operations with a routes table.
