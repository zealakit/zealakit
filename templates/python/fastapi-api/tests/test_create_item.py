from app.application.feature_a.create_item import CreateItem
from app.infrastructure.persistence.feature_a.memory_item_repository import MemoryItemRepository


def test_execute_persists_the_item() -> None:
    repository = MemoryItemRepository()
    item = CreateItem(repository).execute("Widget")
    assert repository.get(item.id) == item
