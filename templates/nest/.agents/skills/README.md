# Project skills

Agent skills for this NestJS + DDD repository. Each skill lives under `.agents/skills/<name>/` with `SKILL.md` and optional `references/`.

## Skills inventory

| Skill | Role |
| --- | --- |
| [structure-ddd](structure-ddd/SKILL.md) | `src/` hexagonal layout, layer dependency rules |
| [nestjs](nestjs/SKILL.md) | Nest modules, DI, testing, API/ORM patterns |
| [typescript](typescript/SKILL.md) | Types, tsconfig, narrowing, erasable syntax |
| [javascript](javascript/SKILL.md) | JS idioms, modules, async, naming |

## Conventions (all skills)

1. **Folder name = `name` frontmatter** — lowercase, hyphens only (`structure-ddd`).
2. **`SKILL.md` ≤ ~500 lines** — critical rules + progressive disclosure table; details go in `references/`.
3. **References are one level deep** — link `references/foo.md` from `SKILL.md` only (no nested reference chains).
4. **Description = WHAT + WHEN** — third person; include trigger terms for discovery.
5. **Cross-link related skills** — language skills ↔ Nest ↔ DDD structure; do not duplicate rules.

## Dependency of concerns

```
structure-ddd  →  where code lives / dependency direction
nestjs         →  Nest framework patterns inside those layers
typescript     →  typing & tsc
javascript     →  runtime idioms
```

When scaffolding a feature: read **structure-ddd** first, then **nestjs**, then language skills as needed.
