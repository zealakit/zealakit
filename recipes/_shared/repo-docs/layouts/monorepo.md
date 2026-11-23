---
layout: monorepo
required:
  - Packages
  - Getting started
  - Scripts
  - Conventions
  - Agent docs
  - License
recipeSections: []
---

# Monorepo layout

Hub README for a workspace with several spokes.

1. **H1** — workspace name plus a tagline.
2. **Packages** — table: package → path → purpose. One row per workspace
   package; link each package README. This table is the navigation hub.
3. **Getting started** — install once at the root, run a package, run the full
   workspace.
4. **Scripts** — table of root scripts only (per-package scripts live in the
   package README).
5. **Conventions** — workspace-level rules: naming, dependency direction,
   release flow, where shared code lives.
6. **Agent docs** — link `AGENTS.md` / `.agents/skills`.
7. **License**.

Each spoke is its own unit in `profile.json` with its own layout. Never repeat
a package's API in the hub; link to the spoke instead.
