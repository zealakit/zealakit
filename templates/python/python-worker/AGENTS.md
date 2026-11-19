# Agent instructions

This project uses skills and rules for **where files go** and **how to write asyncio worker code**.

## Always follow

- **Structure:** [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md) — layers and composition root
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `src/app/main.py` (`uv run python -m app.main`). Imports start at `app.`; use `uv` for everything.
