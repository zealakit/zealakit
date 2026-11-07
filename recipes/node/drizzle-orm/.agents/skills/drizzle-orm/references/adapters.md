# Drizzle adapters & schema

## Table schema (infrastructure only)

```typescript
// infrastructure/persistence/drizzle/schema.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
```

Export relations with `relations(...)` when you use the relational query API; keep them next to tables in infrastructure.

## Persistence mapping

Map selected rows to domain aggregates in mappers / adapter helpers. On read, use `Item.reconstitute(...)` so create events are not re-emitted.

There is usually **no** separate `ItemOrmEntity` class — the table schema + inferred select type is the persistence model. Feature folders may still keep `mappers/` next to the adapter for clarity.

## Repository adapter (Nest)

```typescript
@Injectable()
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async save(item: Item): Promise<void> {
    await this.db
      .insert(items)
      .values({
        id: item.id.toString(),
        name: item.getName(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: items.id,
        set: { name: item.getName() },
      });
  }

  async findById(id: ItemId): Promise<Item | null> {
    const [row] = await this.db.select().from(items).where(eq(items.id, id.toString())).limit(1);
    return row ? toItemDomain(row) : null;
  }
}
```

Bind `FEATURE_*_TOKENS.*_REPOSITORY` → `ItemRepositoryAdapter` in the feature Nest module. `DRIZZLE` comes from the global `DrizzlePersistenceModule`.

## Repository adapter (Hono)

```typescript
export class ItemRepositoryAdapter implements ItemRepository {
  constructor(private readonly db: DrizzleDb) {}
  // same queries as Nest
}
```

## Rules

- Never import `schema.ts` from `domain/` or application handlers.
- Prefer typed `db` (`DrizzleDb`) over `unknown` once the client is implemented.
- Keep SQL/drizzle builders inside adapters (or small infra query helpers), not controllers.
