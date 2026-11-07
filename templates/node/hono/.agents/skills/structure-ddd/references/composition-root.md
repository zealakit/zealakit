# Composition root

## Port tokens (application)

```typescript
// application/feature-a/tokens/feature-a.tokens.ts
export const FEATURE_A_TOKENS = {
  ITEM_REPOSITORY: Symbol.for("feature-a.ItemRepository"),
} as const;
```

Rules:

- One token map per feature (`FEATURE_<X>_TOKENS`).
- Use `Symbol.for("feature.PortName")` for stable documentation keys.
- Never import adapter classes in the tokens file.
- Hono does not inject by token — tokens document the port; factories pass concrete deps.

## Handler construction

```typescript
export class CreateItemHandler {
  constructor(private readonly itemRepository: ItemRepositoryPort) {}
}
```

Type the parameter as the **port** (`ItemRepositoryPort` / `ItemRepository`), not the adapter.

## Binding (bootstrap)

```typescript
// bootstrap/modules/feature-a.ts
export function createFeatureA() {
  const itemRepository = new ItemRepositoryAdapter();
  const createItemHandler = new CreateItemHandler(itemRepository);
  return { createItemHandler };
}
```

Only `bootstrap/modules/*` (and `container.ts` / `create-app.ts`) should know both the port and the concrete adapter.

## App composition

```typescript
// bootstrap/container.ts
export function createContainer(): AppContainer {
  return {
    featureA: createFeatureA(),
    featureB: createFeatureB(),
  };
}

// bootstrap/create-app.ts
app.route("/api/v1/feature-a", createFeatureARoutes(container.featureA));
```

## Port re-export

Domain owns the repository interface. Application re-exports for the use-case boundary:

```typescript
// application/feature-a/ports/output/item.repository.port.ts
import type { ItemRepository } from "@/domain/feature-a/repositories/item.repository.js";

export type ItemRepositoryPort = ItemRepository;
```

## Swapping ORM

1. Keep `ItemRepository` / handler constructor unchanged.
2. Replace or rewrite `ItemRepositoryAdapter` internals (TypeORM, MikroORM, Drizzle, …).
3. Update only the `new Adapter(...)` call in `bootstrap/modules/feature-a.ts`.
