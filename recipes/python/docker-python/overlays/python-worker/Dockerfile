# syntax=docker/dockerfile:1
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.loc[k] ./
RUN uv sync --no-dev

FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app/src PYTHONUNBUFFERED=1
RUN useradd --create-home app
COPY --from=build /app/.venv /app/.venv
COPY src ./src
USER app
CMD ["python", "-m", "app.main"]
