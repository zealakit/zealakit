# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write Hono + DDD code**. Recipe libraries are examples only.

## Always follow

- **Structure:** [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md) — hexagonal layers, feature placement, composition root
- **Hono:** [.agents/skills/hono/SKILL.md](.agents/skills/hono/SKILL.md) — routes, middleware, Node adapter, testing
- **TypeScript:** [.agents/skills/typescript/SKILL.md](.agents/skills/typescript/SKILL.md) — types, tsconfig, narrowing
- **JavaScript:** [.agents/skills/javascript/SKILL.md](.agents/skills/javascript/SKILL.md) — modules, async, idioms
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `src/bootstrap/main.ts`. Path alias: `@/*` → `src/*`. Keep `.js` extensions under `nodenext` (e.g. `@/application/.../handler.js`).
