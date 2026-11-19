from fastapi import FastAPI

from app.bootstrap.config import get_settings
from app.bootstrap.container import Container, build_container
from app.presentation.http import health
from app.presentation.http.api.v1 import feature_a


def create_app(container: Container | None = None) -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.state.container = container or build_container()
    app.include_router(health.router)
    app.include_router(feature_a.router, prefix="/api/v1")
    return app


app = create_app()
