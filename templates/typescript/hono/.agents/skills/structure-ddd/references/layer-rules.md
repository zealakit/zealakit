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

**Must not:** `hono`, ORM decorators, `fetch`/HTTP clients, `process.env`, route factories.

```typescript
// ✅ domain port
export interface ItemRepository {
  save(item: Item): Promise<void>;
  findById(id: ItemId): Promise<Item | null>;
}
```

## Application

**May:** domain types, constructor-injected ports on handlers, tokens, command/query objects.

**Must not:** Hono route factories, ORM entities, concrete adapters.

Handlers depend on **ports**, never on `ItemRepositoryAdapter`.

## Presentation

**May:** application commands/handlers/DTOs, Hono `Hono` / `Context`, middleware.

**Must not:** call infrastructure adapters or mutate aggregates directly.

## Infrastructure

**May:** implement domain/application ports; persistence mappers; vendor SDKs.

**Must not:** expose HTTP routes; contain use-case orchestration beyond technical mapping.

Prefer adapter class names without vendor lock-in:

```text
✅ item.repository.adapter.ts  → ItemRepositoryAdapter
❌ typeorm-item.repository.ts  → TypeormItemRepository
```

## Shared

**May:** pure helpers with no business policy.

**Must not:** grow into a second application layer.

## Bootstrap

**May:** import every layer to construct the graph and mount routes.

**Must not:** put business rules in `main.ts` / `create-app.ts`.
