import type { Item } from "@/domain/feature-a/aggregates/item.aggregate.js";
import type { ItemRepository } from "@/domain/feature-a/repositories/item.repository.js";
import type { ItemId } from "@/domain/feature-a/value-objects/item-id.vo.js";
import type { ItemOrmEntity } from "./entities/item.orm-entity.js";
import { toItemDomain, toItemOrmEntity } from "./mappers/item.persistence.mapper.js";

/**
 * Persistence adapter for ItemRepository.
 *
 * Swap the in-memory store for TypeORM, MikroORM, Drizzle, or another client
 * without changing the domain port or application handlers.
 */
export class ItemRepositoryAdapter implements ItemRepository {
  private readonly store = new Map<string, ItemOrmEntity>();

  async save(item: Item): Promise<void> {
    const orm = toItemOrmEntity(item);
    this.store.set(orm.id, orm);
  }

  async findById(id: ItemId): Promise<Item | null> {
    const orm = this.store.get(id.toString());
    return orm ? toItemDomain(orm) : null;
  }
}
