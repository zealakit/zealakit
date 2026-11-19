import type { TemplateConfig } from "@zealakit/core/ecosystem";

/**
 * Python templates are not Discovery-ranked yet: `discoverable: false` keeps them out of
 * the questionnaire (whose ranking is pinned by tests) but available everywhere else.
 */
export const templateList: TemplateConfig[] = [
  {
    id: "fastapi-api",
    discoverable: false,
    name: "FastAPI",
    label: "FastAPI + Python",
    scope: "server",
    ecosystem: "python",
    description:
      "FastAPI service with DDD-inspired layers, pydantic-settings, pytest and ruff (managed with uv)",
    path: "python/fastapi-api",
    devCommand: "uv run uvicorn app.main:app --reload --app-dir src",
  },
  {
    id: "python-worker",
    discoverable: false,
    name: "Python worker",
    label: "Python background worker",
    scope: "infrastructure",
    ecosystem: "python",
    description:
      "asyncio background worker with graceful shutdown, pytest and ruff (managed with uv)",
    path: "python/python-worker",
    devCommand: "uv run python -m app.main",
  },
];
