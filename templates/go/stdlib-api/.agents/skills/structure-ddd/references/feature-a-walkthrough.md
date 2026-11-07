# Feature A walkthrough (Create Item)

Reference vertical slice. Copy this shape when adding another feature.

## Request path

```text
POST /api/v1/feature-a/items
  → presentation/http/api/v1/featurea.Handler.CreateItem
    → application/featurea.CreateItem.Execute
      → domain/featurea.CreateItem
      → domain.ItemRepository.Save
      → infrastructure/persistence/featurea.MemoryItemRepository
  → 201 { id, name }
```

## Files

| Layer | Path |
| --- | --- |
| Domain VO | `internal/domain/featurea/item_id.go` |
| Aggregate | `internal/domain/featurea/item.go` |
| Port | `internal/domain/featurea/repository.go` |
| Use case | `internal/application/featurea/create_item.go` |
| Adapter | `internal/infrastructure/persistence/featurea/memory_item_repository.go` |
| HTTP | `internal/presentation/http/api/v1/featurea/handler.go` |
| Composition | `internal/bootstrap/featurea.go` |

## Notes

- Package folder is `featurea` (Go package names cannot contain `-`); URL keeps `feature-a` to match Nest/Hono.
- Persistence starts in-memory — swap the adapter without touching domain or application.
- Domain events are recorded on create (`PullDomainEvents`); publish via a bus port when needed.
