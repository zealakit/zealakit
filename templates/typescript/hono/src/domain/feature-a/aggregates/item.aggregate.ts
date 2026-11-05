import { ItemCreatedEvent } from "../events/item-created.event.js";
import { ItemId } from "../value-objects/item-id.vo.js";

export class Item {
  private readonly domainEvents: ItemCreatedEvent[] = [];

  private constructor(
    readonly id: ItemId,
    private name: string,
  ) {}

  static create(name: string): Item {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Item name cannot be empty");
    }

    const item = new Item(ItemId.generate(), trimmed);
    item.domainEvents.push(new ItemCreatedEvent(item.id, item.name));
    return item;
  }

  static reconstitute(id: ItemId, name: string): Item {
    return new Item(id, name);
  }

  getName(): string {
    return this.name;
  }

  pullDomainEvents(): ItemCreatedEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }
}
