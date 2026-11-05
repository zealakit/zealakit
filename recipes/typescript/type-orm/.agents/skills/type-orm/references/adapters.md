# TypeORM adapters & entities

## Persistence model

Decorate only infrastructure entities:

```typescript
// infrastructure/persistence/feature-a/entities/item.orm-entity.ts
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "items" })
export class ItemOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
```

Map to/from the domain aggregate in a persistence mapper (`toItemOrmEntity` / `toItemDomain`). Use `Item.reconstitute(...)` on read so create-side domain events are not re-fired.

## Repository adapter (Nest)

```typescript
@Injectable()
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(
    @InjectRepository(ItemOrmEntity)
    private readonly items: Repository<ItemOrmEntity>,
  ) {}

  async save(item: Item): Promise<void> {
    await this.items.save(toItemOrmEntity(item));
  }

  async findById(id: ItemId): Promise<Item | null> {
    const row = await this.items.findOne({ where: { id: id.toString() } });
    return row ? toItemDomain(row) : null;
  }
}
```

Bind in the feature module:

```typescript
TypeOrmModule.forFeature([ItemOrmEntity]),
{
  provide: FEATURE_A_TOKENS.ITEM_REPOSITORY,
  useClass: ItemRepositoryAdapter,
},
```

## Repository adapter (Hono)

Receive `DataSource` (or `Repository`) from the composition root — no Nest `@InjectRepository`:

```typescript
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get items() {
    return this.dataSource.getRepository(ItemOrmEntity);
  }
  // …
}
```

## Rules

- Application handlers depend on the **port** + token, never on `Repository<ItemOrmEntity>`.
- Do not expose TypeORM entities through controllers — map to presentation / application DTOs.
- Keep relation graphs on ORM entities; domain aggregates express invariants, not join metadata.
