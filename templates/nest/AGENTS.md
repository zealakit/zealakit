# Agent instructions

This project uses Cursor skills and rules for **where files go** and **how to write NestJS + DDD code**. Recipe libraries are examples only.

## Always follow

- **Structure:** [.agents/skills/structure-ddd/SKILL.md](.agents/skills/structure-ddd/SKILL.md) — hexagonal layers, feature placement, DI ports/adapters
- **NestJS:** [.agents/skills/nestjs/SKILL.md](.agents/skills/nestjs/SKILL.md) — modules, DI, testing, API / ORM patterns
- **TypeScript:** [.agents/skills/typescript/SKILL.md](.agents/skills/typescript/SKILL.md) — types, tsconfig, narrowing
- **JavaScript:** [.agents/skills/javascript/SKILL.md](.agents/skills/javascript/SKILL.md) — modules, async, idioms
- **Rules:** [.agents/rules/](.agents/rules/)

Entry: `src/bootstrap/main.ts`. Path alias: `@/*` → `src/*`. Keep `.js` extensions under `nodenext` (e.g. `@/application/.../handler.js`).
