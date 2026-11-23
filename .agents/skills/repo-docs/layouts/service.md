---
layout: service
required:
  - Stack
  - Requirements
  - Getting started
  - Scripts
  - Environment
  - API
  - Health check
  - Project structure
  - Deployment
  - Agent docs
  - License
recipeSections:
  - Database
  - Docker
  - Authentication
  - Testing
  - CI
---

# Service layout

HTTP API or backend service (Nest, Hono, FastAPI, Go stdlib/Gin, …).

Same as the `app` layout except:

- **API** replaces the UI-only sections. A routes table (method, path, auth,
  handler) or a link to the generated OpenAPI document. Do not describe every
  DTO — one row per route, request/response details in `docs/` if needed.
- **Health check** documents the endpoint path, the port from configuration and
  what "healthy" means (dependency checks included).
- **Database**, **Authentication**, **Testing** and **CI** come from
  `profile.sections`, in the order listed by `recipeSections`.

Fixed order:

H1 → tagline → Stack → Requirements → Getting started → Scripts → Environment →
API → Health check → recipe sections → Project structure → Deployment →
Agent docs → License.
