---
name: github-actions
description: Understand and extend the generated GitHub Actions CI workflow for this Python project.
---

# GitHub Actions CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: `uv sync`, `ruff check`, `ruff format --check`, `pytest` (and a Docker build when the Docker recipe is present).

Keep CI commands identical to the local ones; commit `uv.lock` and enable caching (`enable-cache: true` on `astral-sh/setup-uv`) once it exists.
