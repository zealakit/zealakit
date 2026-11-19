---
name: sqlalchemy
description: SQLAlchemy 2 persistence for this service. Use when adding models, repositories or changing the database session.
---

# SQLAlchemy

- `infrastructure/persistence/database.py` — engine + session factory from `DATABASE_URL` (default `sqlite:///./app.db`).
- `infrastructure/persistence/models.py` — declarative `Base` and ORM models (persistence only; never import them from `domain/`).
- `infrastructure/persistence/feature_a/sqlalchemy_item_repository.py` — implements the `ItemRepository` port.

## Conventions

- One session per unit of work; commit in the repository method or the use case, never in routers.
- Map ORM rows to domain entities at the repository boundary.
- Tables are created with `Base.metadata.create_all` for local development. Use the `alembic` recipe for real migrations (it sets `AUTO_CREATE_TABLES = False` in `database.py`).
- Set `DATABASE_URL` for other databases (for example `postgresql+psycopg://…` with the `postgres-python` recipe).
