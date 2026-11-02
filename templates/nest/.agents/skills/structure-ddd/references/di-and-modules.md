# DI tokens and feature modules

## Token definition (application)

```typescript
// application/feature-a/tokens/feature-a.tokens.ts
export const FEATURE_A_TOKENS = {
  ITEM_REPOSITORY: Symbol.for("feature-a.ItemRepository"),
} as const;
```

Rules:

- One token map per feature (`FEATURE_<X>_TOKENS`).
- Use `Symbol.for("feature.PortName")` for stable keys across bundles.
- Never import adapter classes in the tokens file.

## Handler injection

```typescript
@Injectable()
export class CreateItemHandler {
  constructor(
    @Inject(FEATURE_A_TOKENS.ITEM_REPOSITORY)
    private readonly itemRepository: ItemRepositoryPort,
  ) {}
}
```

Type the parameter as the **port** (`ItemRepositoryPort` / `ItemRepository`), not the adapter.

## Binding (bootstrap)

```typescript
// bootstrap/modules/feature-a.module.ts
import { CreateItemHandler } from "@/application/feature-a/handlers/create-item.handler.js";
import { FEATURE_A_TOKENS } from "@/application/feature-a/tokens/feature-a.tokens.js";
import { ItemRepositoryAdapter } from "@/infrastructure/persistence/feature-a/item.repository.adapter.js";
import { FeatureAController } from "@/presentation/http/api/v1/feature-a/feature-a.controller.js";

@Module({
  controllers: [FeatureAController],
  providers: [
    CreateItemHandler,
    {
      provide: FEATURE_A_TOKENS.ITEM_REPOSITORY,
      useClass: ItemRepositoryAdapter,
    },
  ],
  exports: [FEATURE_A_TOKENS.ITEM_REPOSITORY],
})
export class FeatureAModule {}
```

Only `bootstrap/modules/*` (and `app.module.ts`) should know both the token and the concrete adapter.

## App composition

```typescript
// bootstrap/app.module.ts
@Module({
  imports: [FeatureAModule, FeatureBModule],
})
export class AppModule {}
```

## Port re-export

Domain owns the repository interface. Application re-exports for the use-case boundary:

```typescript
// application/feature-a/ports/output/item.repository.port.ts
import type { ItemRepository } from "@/domain/feature-a/repositories/item.repository.js";

export type ItemRepositoryPort = ItemRepository;
```

## Swapping ORM

1. Keep `ItemRepository` / `FEATURE_A_TOKENS.ITEM_REPOSITORY` unchanged.
2. Replace or rewrite `ItemRepositoryAdapter` internals (TypeORM, MikroORM, …).
3. Update only the `useClass` (or `useFactory`) binding in `feature-a.module.ts`.
