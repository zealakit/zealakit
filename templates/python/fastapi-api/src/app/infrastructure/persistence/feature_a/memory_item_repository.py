from app.domain.feature_a.item import Item


class MemoryItemRepository:
    """In-memory adapter (process-local; replace with a real store)."""

    def __init__(self) -> None:
        self._items: dict[str, Item] = {}

    def save(self, item: Item) -> None:
        self._items[item.id] = item

    def get(self, item_id: str) -> Item | None:
        return self._items.get(item_id)
