from dataclasses import dataclass
from uuid import uuid4


class InvalidItemName(ValueError):
    """Raised when an item name is empty or too long."""


@dataclass(frozen=True)
class Item:
    id: str
    name: str

    @classmethod
    def create(cls, name: str) -> "Item":
        cleaned = name.strip()
        if not cleaned or len(cleaned) > 100:
            raise InvalidItemName("name must be 1-100 characters")
        return cls(id=str(uuid4()), name=cleaned)
