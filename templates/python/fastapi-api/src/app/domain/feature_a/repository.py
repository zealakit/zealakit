from typing import Protocol

from app.domain.feature_a.item import Item


class ItemRepository(Protocol):
    """Port implemented by infrastructure adapters."""

    def save(self, item: Item) -> None: ...

    def get(self, item_id: str) -> Item | None: ...
