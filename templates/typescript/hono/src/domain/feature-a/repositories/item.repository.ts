import type { Item } from "../aggregates/item.aggregate.js";
import type { ItemId } from "../value-objects/item-id.vo.js";

/**
 * Domain repository port — pure TypeScript, no Hono/ORM imports.
 */
export interface ItemRepository {
  save(item: Item): Promise<void>;
  findById(id: ItemId): Promise<Item | null>;
}
