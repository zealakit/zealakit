---
name: postgres-python
description: PostgreSQL for this Python service via psycopg 3. Use when configuring the database URL or running against Postgres.
---

# PostgreSQL (psycopg 3)

Adds the `psycopg[binary]` driver and `DATABASE_URL` to `.env.example`:

```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app
```

## Conventions

- Use the `postgresql+psycopg://` scheme with SQLAlchemy; the sqlite default is for local tests only.
- Start a local database with `docker compose up db` when the `docker-python` recipe is selected.
