# Extending Zealakit

Use this when adding or changing templates/recipes in the **kit repo**.

## Add a template (e.g. a new framework such as SvelteKit)

1. Create `templates/<id>/` (runnable starter + its own `.agents/` / `AGENTS.md` for **generated** apps). Add `.cursor` as a symlink to `.agents`.
2. If the framework is new, add it to `FRAMEWORKS` in `src/constants.ts`.
3. Register in `src/registry/templates.ts`:
   - `id`, `path`, `scope` (from `SCOPES`), `name`, `label` (prompt text), `description`
   - `framework` for UI templates (omit for server templates)
   - optional `overlay` if overlay folder name ≠ `id`
   - optional `srcDir` when the app root is not `src/` (Nuxt: `app`)
   - optional `devCommand` when it is not `npm run dev`
4. Every compatible recipe that has `overlays/` needs `overlays/<overlayId>/` — otherwise it is rejected for this template (and hidden from prompts). This includes **default** recipes (`client-shared-pieces`), so add that overlay first.
5. Run `pnpm test <id>`: the matrix in `tests/scaffold/matrix.test.ts` scaffolds the template with every compatible recipe automatically. Add `tests/scaffold/<id>.test.ts` (via `templateSuite`) for template-specific expectations.

## Add a recipe

1. Create `recipes/<id>/` with `shared/` and/or `overlays/<overlay>/` as needed.
2. Create `src/registry/recipes/<id>.ts` exporting `defineRecipe({ … })` (file name **must** equal the id — the monitor edits that file) and add it to `RECIPE_LIST` in `src/registry/recipes/index.ts` (list order = prompt order).
   - `category` from `RECIPE_CATEGORIES` (single value or array for multi-tag recipes)
   - `frameworks` when the recipe only works with some UI frameworks (`["react"]`, `["vue"]`); omit for agnostic recipes (linters, fetchers, ORMs, Storybook)
   - `supportedScopes`, `exclusive` / `default` as appropriate; optional `hint` for prompts
   - `packages` / `devDependencies` / overlay package maps
   - `fileTransforms` keyed by template id or overlay id — prefer helpers in `define.ts` (`viteReactAppProvider`, `nextUiProviders`, `nuxtModule`, `nuxtConfigKeys`, `serverOrmWiring`, `appendExport`)
   - optional `finalize(targetDir)` for post-copy fixes that are not text transforms
3. Optional `scaffold/agent-entry.md` — markdown list lines linked into generated `AGENTS.md` / `CLAUDE.md`.
4. Optional `.agents/skills|rules` — copied into the generated project (consumer guidance), not kit maintainer docs. Keep recipe `.cursor` → `.agents` symlink (no duplicate content under `.cursor`).
5. Prompts pick the recipe up automatically for its category (no prompt code changes). A new **category** needs a step in `STEPS_BY_SCOPE` in `src/prompts.ts`.
6. Add expectations to the relevant `tests/scaffold/<template>.test.ts` files; the matrix already checks deps, scripts, agent entries, and leaks.
7. If introducing a new category, scope, or framework value, update `src/constants.ts` first.

## Overlay rules

- Overlay id = `template.overlay ?? template.id` (`getTemplateOverlayId`).
- If `recipes/<id>/overlays/` exists, the matching overlay directory is **required**; `compat.ts` rejects the combination up front otherwise.
- Framework-specific providers (e.g. Next `AppRouterCacheProvider`) belong in `overlays/next`, not `shared/`.
- Nest-only config (e.g. Biome decorator parser flags, ORM Nest modules) belongs in `overlays/nest`.
- Exclusive `orm` recipes (`type-orm`, `mikro-orm`, `drizzle-orm`) support `server` scope only; add `overlays/<be-template>/` for each BE template (`nest`, `hono`, …).

## fileTransforms

```ts
fileTransforms: {
  "vite-react": viteReactAppProvider("MuiThemeProvider", "mui-theme-provider"),
  next: [{ file: "src/app/layout.tsx", append: "..." }], // overlay id also OK
  nest: [{ file: "src/bootstrap/main.ts", pattern: /.../, replacement: "..." }],
}
```

- Prefer surgical regex/`append`; a pattern that does not match throws.
- Server templates `nest` / `hono` use matching overlay ids.
- Client SPA overlays follow template id (`vite-react`, `vite-vue`). Hybrid overlays: `next`, `nuxt`. React-only UI kits are rejected on Vue templates via `frameworks`, not via empty overlay stubs.
- **Nuxt:** recipe `src/` is folded into `app/` (`srcDir`). Nuxt `fileTransforms` should target `app/…` paths.

## Verify

```bash
pnpm check          # biome
pnpm typecheck      # src, tests, scripts, monitor
pnpm test           # unit + in-process scaffold tests (seconds)
pnpm test next mui  # only tests whose names match "next" or "mui"
pnpm test --unit    # unit tests only (--scaffold for scaffold tests)
pnpm test:pack      # release smoke: build → pack → tarball contents → real CLI runs
pnpm monitor        # dependency dashboard (kit-internal)
```

## Monitor notes

- Scans root + `templates/*/package.json` + recipe pins from `src/registry/recipes/<id>.ts`.
- Sort orders for scope/category come from `src/constants.ts` (injected into UI / API).
