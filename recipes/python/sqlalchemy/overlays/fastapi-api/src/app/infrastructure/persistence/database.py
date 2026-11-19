import os

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.persistence.models import Base

DEFAULT_DATABASE_URL = "sqlite:///./app.db"
# Local-development convenience. The `alembic` recipe turns this off: migrations own the schema.
AUTO_CREATE_TABLES = True


def create_db_engine(url: str | None = None) -> Engine:
    database_url = url or os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


def create_session_factory(url: str | None = None) -> sessionmaker[Session]:
    """Create the engine and, unless migrations own the schema, the tables."""
    engine = create_db_engine(url)
    if AUTO_CREATE_TABLES:
        Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)
