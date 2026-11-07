import type { ItemId } from "../value-objects/item-id.vo.js";

export class ItemCreatedEvent {
  readonly occurredAt: Date;

  constructor(
    readonly itemId: ItemId,
    readonly name: string,
  ) {
    this.occurredAt = new Date();
  }
}
