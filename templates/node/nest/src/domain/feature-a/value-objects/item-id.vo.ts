export class ItemId {
  private constructor(private readonly value: string) {}

  static create(raw: string): ItemId {
    const normalized = raw.trim();
    if (!normalized) {
      throw new Error("ItemId cannot be empty");
    }
    return new ItemId(normalized);
  }

  static generate(): ItemId {
    return new ItemId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other: ItemId): boolean {
    return this.value === other.value;
  }
}
