# Agent instructions

This project uses skills and rules for **where files go** and **how to write FastAPI + DDD code**.

## Always follow

- **Structure:** [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md) — layers, composition root, feature placement
- **FastAPI:** [.agents/skills/fastapi/SKILL.md](.agents/skills/fastapi/SKILL.md) — routers, dependencies, settings, testing
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `src/app/main.py`. Imports start at `app.` (`src/` is on the path). Use `uv` for everything (`uv sync`, `uv run …`).
