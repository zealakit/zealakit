<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write UI** in the Next.js App Router. Recipe libraries are examples only.

## Always follow

- **Structure:** [.agents/skills/project-structure/SKILL.md](.agents/skills/project-structure/SKILL.md) — route groups, `_components` / `_shared`, server vs client exports, i18n placement
- **UI:** [.agents/skills/reactjs/SKILL.md](.agents/skills/reactjs/SKILL.md) — generating, refactoring, and optimizing React / Next UI
- **Next.js guides:** read `node_modules/next/dist/docs/` before using unfamiliar APIs (see block above)
- **Rules:** [.agents/rules/](.agents/rules/)

Path alias: `@/*` → `src/*`.
