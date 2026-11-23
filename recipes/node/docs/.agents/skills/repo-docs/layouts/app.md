---
layout: app
required:
  - Stack
  - Requirements
  - Getting started
  - Scripts
  - Environment
  - Project structure
  - Deployment
  - Agent docs
  - License
recipeSections:
  - Database
  - Docker
  - Authentication
  - Testing
  - CI
---

# App layout

UI application (Vite, Next, Nuxt, Astro, …). Section order is fixed:

1. **H1** — the unit name from `profile.json`, plus a one-line tagline.
2. **Stack** — table: area → technology (framework, language, styling, state).
3. **Requirements** — runtime versions from the manifest (`engines`, `.nvmrc`).
4. **Getting started** — install, run dev, run build. One code block per step.
5. **Scripts** — table: script → command → what it does. Every row exists in the
   manifest. This is the only place scripts are listed.
6. **Environment** — table: key → default → required → description. Keys must
   match `.env.example` exactly (both directions).
7. **Recipe sections** — only the ones in `profile.sections`, in the order
   `recipeSections` lists. Facts come from the recipe files, never from memory.
8. **Project structure** — a short tree plus a link to the project-structure
   skill or `docs/architecture.md`. Do not duplicate the tree in prose.
9. **Deployment** — build output, host assumptions, container command. Skip the
   section only if the app genuinely cannot be deployed (do not leave a stub).
10. **Agent docs** — link `AGENTS.md` / `.agents/skills` for contributors.
11. **License** — one line, matching the manifest.

No component API tables here — they belong to the `library` layout.
