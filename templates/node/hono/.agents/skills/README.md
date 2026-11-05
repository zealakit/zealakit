# Project skills

Agent skills for this Hono + DDD repository. Each skill lives under `.agents/skills/<name>/` with `SKILL.md` and optional `references/`.

## Skills inventory

| Skill | Role |
| --- | --- |
| [structure-ddd](structure-ddd/SKILL.md) | `src/` hexagonal layout, layer dependency rules |
| [hono](hono/SKILL.md) | Routes, middleware, Node server, testing |
| [typescript](typescript/SKILL.md) | Slim project typing rules (`strict`, nodenext, no encyclopedia) |
| [javascript](javascript/SKILL.md) | Slim ESM/async/naming defaults (no language dump) |

## Conventions (all skills)

1. **Folder name = `name` frontmatter** — lowercase, hyphens only (`structure-ddd`).
2. **`SKILL.md` ≤ ~500 lines** — critical rules + progressive disclosure table; details go in `references/`.
3. **References are one level deep** — link `references/foo.md` from `SKILL.md` only (no nested reference chains).
4. **Description = WHAT + WHEN** — third person; include trigger terms for discovery.
5. **Cross-link related skills** — language skills ↔ Hono ↔ DDD structure; do not duplicate rules.

## Dependency of concerns

```
structure-ddd  →  where code lives / dependency direction
hono           →  Hono framework patterns inside those layers
typescript     →  typing & tsc
javascript     →  runtime idioms
```

When scaffolding a feature: read **structure-ddd** first, then **hono**, then language skills as needed.
