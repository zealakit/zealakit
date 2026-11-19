---
name: fastapi
description: >-
  FastAPI conventions for this project: routers, dependency injection through
  the container, pydantic-settings, error mapping and testing with TestClient.
---

# FastAPI

- Routers live in `presentation/http/`; include them in `main.py` with a prefix.
- Get use cases through a dependency (`Depends(get_container)`), never import adapters in routers.
- Request/response bodies are Pydantic models; map domain errors to `HTTPException` in the router.
- Settings: `app/bootstrap/config.py` (`pydantic-settings`); no module-level `os.environ` reads elsewhere.
- Tests: `fastapi.testclient.TestClient(create_app())`; override the container for isolation.
- Commands: `uv run pytest`, `uv run ruff check .`, `uv run uvicorn app.main:app --reload --app-dir src`.
