from dataclasses import dataclass

from app.domain.feature_a.item import Item
from app.domain.feature_a.repository import ItemRepository


@dataclass(frozen=True)
class CreateItem:
    """Use case: create and persist an item."""

    repository: ItemRepository

    def execute(self, name: str) -> Item:
        item = Item.create(name)
        self.repository.save(item)
        return item
