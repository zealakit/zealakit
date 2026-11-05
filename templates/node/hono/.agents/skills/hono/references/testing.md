# Testing

## E2E / integration

```typescript
import { createApp } from "../src/bootstrap/create-app.js";

const app = createApp();
const response = await app.request("/api/v1/feature-a/items", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Hexagonal Item" }),
});
```

Uses the Web Fetch API — no Supertest / Nest TestingModule required.

## Unit tests

- Test handlers with a fake `ItemRepositoryPort`.
- Test domain aggregates without Hono.
- Prefer vitest (`*.spec.ts` / `*.e2e-spec.ts`).
