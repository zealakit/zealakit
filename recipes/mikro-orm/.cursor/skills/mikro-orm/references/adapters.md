# MikroORM adapters & entities

## Persistence model

With `experimentalDecorators` (Nest / this recipe’s Hono transform), use **legacy** decorators:

```typescript
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity({ tableName: "items" })
export class ItemOrmEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "string" })
  name!: string;

  @Property({ fieldName: "created_at" })
  createdAt!: Date;
}
```

Map to/from domain in a persistence mapper. Rehydrate with `Item.reconstitute(...)` on reads.

## Repository adapter (Nest)

```typescript
@Injectable()
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(private readonly em: EntityManager) {}

  async save(item: Item): Promise<void> {
    const orm = toItemOrmEntity(item);
    await this.em.upsert(ItemOrmEntity, orm); // or persist + flush
  }

  async findById(id: ItemId): Promise<Item | null> {
    const row = await this.em.findOne(ItemOrmEntity, { id: id.toString() });
    return row ? toItemDomain(row) : null;
  }
}
```

Bind the domain port token to `ItemRepositoryAdapter` in `bootstrap/modules/<feature>.module.ts`. Clear the identity map between requests via Nest’s request-scoped EM (MikroORM Nest integration) or an explicit `em.fork()`.

## Repository adapter (Hono)

Pass a forked `EntityManager` from the composition root / request middleware:

```typescript
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(private readonly em: EntityManager) {}
  // same mapping as Nest
}
```

## Rules

- Do not put `@Entity` on domain aggregates.
- Prefer `em.persist` / `em.flush` or `em.upsert` deliberately — know whether you need one flush per use-case.
- Application handlers never import `@mikro-orm/*`.
