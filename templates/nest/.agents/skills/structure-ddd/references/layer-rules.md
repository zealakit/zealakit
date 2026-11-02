# Layer rules

## Allowed imports

| From \ To | domain | application | presentation | infrastructure | shared | bootstrap |
| --- | --- | --- | --- | --- | --- | --- |
| **domain** | yes (same feature preferred) | no | no | no | yes (pure only) | no |
| **application** | yes | same feature | no | no | yes | no |
| **presentation** | no* | yes | yes | no | yes | no |
| **infrastructure** | yes | no** | no | yes | yes | no |
| **shared** | no | no | no | no | yes | no |
| **bootstrap** | yes | yes | yes | yes | yes | yes |

\* Presentation should not reach into domain aggregates for writes; map via application DTOs/results. Reading small domain types for typing is discouraged — prefer application result DTOs.

\*\* Infrastructure implements ports defined in domain/application; it must not call application handlers.

## Domain

**May:** plain TypeScript classes/types, `shared` pure utils.

**Must not:** `@nestjs/*`, ORM decorators, `fetch`/HTTP clients, `process.env`, controllers.

```typescript
// ✅ domain port
export interface ItemRepository {
  save(item: Item): Promise<void>;
  findById(id: ItemId): Promise<Item | null>;
}
```

## Application

**May:** domain types, Nest `@Injectable` / `@Inject` on handlers, tokens, command/query objects.

**Must not:** HTTP decorators (`@Controller`, `@Body`), ORM entities, concrete adapters.

Handlers depend on **ports + tokens**, never on `ItemRepositoryAdapter`.

## Presentation

**May:** application commands/handlers/DTOs, Nest HTTP decorators, validation pipes.

**Must not:** call infrastructure adapters or mutate aggregates directly.

## Infrastructure

**May:** implement domain/application ports; persistence mappers; vendor SDKs.

**Must not:** expose Nest controllers; contain use-case orchestration beyond technical mapping.

Prefer adapter class names without vendor lock-in:

```text
✅ item.repository.adapter.ts  → ItemRepositoryAdapter
❌ typeorm-item.repository.ts  → TypeormItemRepository
```

## Shared

Only code that would stay valid if every feature were deleted. No “shared Item service”.

## Cross-feature

```text
❌ application/feature-b/handlers/*  imports  application/feature-a/handlers/*
❌ infrastructure/persistence/feature-b/*  imports  feature-a adapters

✅ feature-b listens to a domain/integration event published from feature-a
✅ feature-b depends on an explicit application port implemented in bootstrap wiring
```
