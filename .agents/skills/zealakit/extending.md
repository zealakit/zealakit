# Extending Zealakit

Use this when adding or changing templates/recipes in the **kit repo**.

## Add a template

1. Create `templates/<id>/` (runnable starter + its own `.agents/` / `AGENTS.md` for **generated** apps). Add `.cursor` as a symlink to `.agents`.
2. Register in `src/registry/templates.ts`:
   - `id`, `path`, `scope` (from `SCOPES`), `name`, `description`
   - optional `overlay` if overlay folder name ≠ `id`
3. Ensure every recipe that has `overlays/` includes `overlays/<overlayId>/` (even empty / `.gitkeep` if needed).
4. Add e2e coverage in `scripts/test-e2e-pack.ts` for critical recipe combos.
5. `pnpm install` if the template is a workspace package.

## Add a recipe

1. Create `recipes/<id>/` with `shared/` and/or `overlays/<overlay>/` as needed.
2. Register in `src/registry/recipes.ts`:
   - `category` from `RECIPE_CATEGORIES` (single value or array for multi-tag recipes)
   - Exclusive UI kits: `["ui", "ui-react"]` (or `ui-vue` / `ui-svelte`). Cross-framework UI tooling (e.g. Storybook): plain `ui` (+ other tags) — no framework tag
   - `supportedScopes`, `exclusive` / `default` as appropriate
   - `packages` / `devDependencies` / overlay package maps
   - `fileTransforms` keyed by template id or overlay id
3. Optional `scaffold/agent-entry.md` — markdown list lines linked into generated `AGENTS.md` / `CLAUDE.md`.
4. Optional `.agents/skills|rules` — copied into the generated project (consumer guidance), not kit maintainer docs. Keep recipe `.cursor` → `.agents` symlink (no duplicate content under `.cursor`).
5. Extend e2e pack tests when the recipe changes scaffold output.
6. If introducing a new category or scope value, update `src/constants.ts` first.

## Overlay rules

- Overlay id = `template.overlay ?? template.id` (`getTemplateOverlayId`).
- If `recipes/<id>/overlays/` exists, the matching overlay directory is **required** at scaffold time.
- Framework-specific providers (e.g. Next `AppRouterCacheProvider`) belong in `overlays/next`, not `shared/`.
- Nest-only config (e.g. Biome decorator parser flags, ORM Nest modules) belongs in `overlays/nest`.
- Exclusive `orm` recipes (`type-orm`, `mikro-orm`, `drizzle-orm`) support `server` scope; add `overlays/<be-template>/` for each BE template (`nest`, `hono`, …).

## fileTransforms

```ts
fileTransforms: {
  "vite-react": [{ file: "src/main.tsx", pattern: /.../, replacement: "..." }],
  next: [{ file: "src/app/layout.tsx", append: "..." }], // overlay id also OK
  nest: [{ file: "src/bootstrap/main.ts", pattern: /.../, replacement: "..." }],
  hono: [{ file: "src/bootstrap/container.ts", pattern: /.../, replacement: "..." }],
}
```

- Prefer surgical regex/`append`; throw if pattern does not match.
- Do not silently no-op failed transforms.
- Server templates `nest` / `hono` use matching overlay ids. Recipes with `overlays/` that support `server` (e.g. biome, eslint, ORMs) must include `overlays/nest/` and `overlays/hono/`.

## Verify

```bash
pnpm check          # biome
pnpm build          # tsup → dist/
pnpm test:pack      # e2e scaffold from packed tarball
pnpm monitor        # dependency dashboard (kit-internal)
```

## Monitor notes

- Scans root + `templates/*/package.json` + recipe pins from `src/registry/recipes.ts`.
- Sort orders for scope/category come from `src/constants.ts` (injected into UI / API).
