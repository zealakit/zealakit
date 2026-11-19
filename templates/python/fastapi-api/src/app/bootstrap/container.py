from dataclasses import dataclass

from app.application.feature_a.create_item import CreateItem
from app.infrastructure.persistence.feature_a.memory_item_repository import MemoryItemRepository


@dataclass(frozen=True)
class Container:
    """Composition root: the only place that knows concrete adapters."""

    create_item: CreateItem


def build_container() -> Container:
    # ORM recipes replace this adapter with a database-backed repository.
    repository = MemoryItemRepository()
    return Container(create_item=CreateItem(repository))
