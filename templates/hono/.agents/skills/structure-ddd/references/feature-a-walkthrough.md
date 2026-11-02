# Feature A walkthrough (Create Item)

Reference implementation of a full vertical slice. Use this when scaffolding another feature.

## Request path

```text
POST /api/v1/feature-a/items
  → feature-a.routes (Hono)
  → CreateItemCommand
  → CreateItemHandler
  → Item.create()                    # domain
  → ItemRepositoryPort.save()
  → ItemRepositoryAdapter            # infrastructure
  → ItemResponseDto
```

## Files involved

| Layer | Path |
| --- | --- |
| Domain VO | `domain/feature-a/value-objects/item-id.vo.ts` |
| Aggregate | `domain/feature-a/aggregates/item.aggregate.ts` |
| Event | `domain/feature-a/events/item-created.event.ts` |
| Port | `domain/feature-a/repositories/item.repository.ts` |
| App port | `application/feature-a/ports/output/item.repository.port.ts` |
| Tokens | `application/feature-a/tokens/feature-a.tokens.ts` |
| Command | `application/feature-a/commands/create-item.command.ts` |
| Handler | `application/feature-a/handlers/create-item.handler.ts` |
| App DTO/mapper | `application/feature-a/dtos/…`, `mappers/item.mapper.ts` |
| HTTP | `presentation/http/api/v1/feature-a/…` |
| Persistence | `infrastructure/persistence/feature-a/…` |
| Composition | `bootstrap/modules/feature-a.ts` |

## Domain sketch

- `ItemId` — validated identity VO.
- `Item.create(name)` — enforces invariants, raises `ItemCreatedEvent`.
- `Item.reconstitute(id, name)` — persistence rehydration without re-firing create events.
- `ItemRepository` — save / findById only; no SQL.

## Application sketch

- Handler receives `ItemRepositoryPort` via constructor.
- Maps aggregate → `CreateItemResultDto` via pure mapper function.
- Does not know about HTTP status codes or ORM entities.

## Presentation sketch

- Parse JSON body at the edge.
- Route builds `CreateItemCommand` and returns `ItemResponseDto` with status `201`.
- Mounted at `/api/v1/feature-a` from `create-app.ts`.

## Infrastructure sketch

- `ItemOrmEntity` — persistence row shape (decorate with chosen ORM later).
- Mappers: `toItemOrmEntity` / `toItemDomain`.
- `ItemRepositoryAdapter` — implements port; scaffold may use in-memory `Map` until a real ORM is wired.

## Composition bind

```typescript
const itemRepository = new ItemRepositoryAdapter();
const createItemHandler = new CreateItemHandler(itemRepository);
```

## Feature B

`feature-b` mirrors the folder skeleton. Keep it independent: no imports from `feature-a` handlers or adapters. When integration is required, add an explicit port or subscribe to events.
