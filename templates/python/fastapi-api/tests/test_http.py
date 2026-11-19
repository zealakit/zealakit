from fastapi.testclient import TestClient

from app.main import create_app


def client() -> TestClient:
    return TestClient(create_app())


def test_health() -> None:
    response = client().get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_item() -> None:
    response = client().post("/api/v1/feature-a/items", json={"name": "Widget"})
    assert response.status_code == 201
    assert response.json()["name"] == "Widget"


def test_create_item_rejects_an_empty_name() -> None:
    response = client().post("/api/v1/feature-a/items", json={"name": " "})
    assert response.status_code == 400
