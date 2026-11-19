from sqlalchemy.orm import Session, sessionmaker

from app.domain.feature_a.item import Item
from app.infrastructure.persistence.models import ItemModel


class SqlAlchemyItemRepository:
    """`ItemRepository` backed by SQLAlchemy."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def save(self, item: Item) -> None:
        with self._session_factory.begin() as session:
            session.merge(ItemModel(id=item.id, name=item.name))

    def get(self, item_id: str) -> Item | None:
        with self._session_factory() as session:
            row = session.get(ItemModel, item_id)
            return Item(id=row.id, name=row.name) if row else None
