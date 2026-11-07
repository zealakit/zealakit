# Routing

## Feature sub-app

```typescript
// presentation/http/api/v1/feature-a/feature-a.routes.ts
export function createFeatureAHttpRoutes(deps: FeatureADeps): Hono {
  const routes = new Hono({ strict: false });
  routes.post("/items", async (c) => { /* … */ });
  return routes;
}
```

Use `{ strict: false }` on the root app and feature sub-apps so `/path` and `/path/` match the same route.

## Mounting

```typescript
// bootstrap/create-app.ts
const app = new Hono({ strict: false });
app.route("/api/v1/feature-a", createFeatureARoutes(container.featureA));
```

Full path: `POST /api/v1/feature-a/items` (trailing slash OK when `strict: false`).

## Context

- `c.req.json()` for JSON bodies
- `c.json(body, status)` for responses
- Prefer explicit status codes (`201` for create)

## Path alias

Cross-layer imports: `@/application/...` with `.js` extensions under `nodenext`.
