import { Item } from "@/domain/feature-a/aggregates/item.aggregate.js";
import { ItemId } from "@/domain/feature-a/value-objects/item-id.vo.js";
import { ItemOrmEntity } from "../entities/item.orm-entity.js";

export function toItemOrmEntity(item: Item): ItemOrmEntity {
  const orm = new ItemOrmEntity();
  orm.id = item.id.toString();
  orm.name = item.getName();
  orm.createdAt = new Date();
  return orm;
}

export function toItemDomain(orm: ItemOrmEntity): Item {
  return Item.reconstitute(ItemId.create(orm.id), orm.name);
}
