from sqlalchemy.orm import sessionmaker

from app.domain.feature_a.item import Item
from app.infrastructure.persistence.database import create_db_engine
from app.infrastructure.persistence.feature_a.sqlalchemy_item_repository import (
    SqlAlchemyItemRepository,
)
from app.infrastructure.persistence.models import Base


def test_round_trip_in_memory_sqlite() -> None:
    engine = create_db_engine("sqlite://")
    Base.metadata.create_all(engine)
    repository = SqlAlchemyItemRepository(sessionmaker(engine, expire_on_commit=False))

    item = Item.create("Widget")
    repository.save(item)

    assert repository.get(item.id) == item
    assert repository.get("missing") is None
