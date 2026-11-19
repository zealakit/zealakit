import pytest

from app.domain.feature_a.item import InvalidItemName, Item


def test_create_trims_the_name_and_assigns_an_id() -> None:
    item = Item.create("  Widget  ")
    assert item.name == "Widget"
    assert item.id


@pytest.mark.parametrize("name", ["", "   ", "x" * 101])
def test_create_rejects_invalid_names(name: str) -> None:
    with pytest.raises(InvalidItemName):
        Item.create(name)
