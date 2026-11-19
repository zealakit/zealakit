# External recipes

A recipe can live outside the kit as a folder of **data** — nothing in it runs.

```bash
zealakit recipe init acme-auth            # scaffold a recipe folder
zealakit recipe validate ./acme-auth      # schema + stage it on every compatible template
zealakit create my-app -t next -w biome,./acme-auth
zealakit add github:acme/recipes/auth#v1.2.0
```

## Format

```
acme-auth/
  recipe.json          # data form of a recipe (schema/recipe.schema.json)
  shared/              # copied into every project (like built-in recipes)
  overlays/<template>/ # per-template files
  scaffold/agent-entry.md
  .agents/
```

`recipe.json` declares `id`, `name`, `category`, `supportedScopes`, optional `ecosystem`, `uiFrameworks`, `exclusive`, `dependsOn`, `requiresAnyOf`, `npm` (`dependencies`, `devDependencies`, `scripts`, `overlayDependencies`, `overlayDevDependencies`) or `go.modules`, and `transforms` — per template: `{ file, pattern, flags, replacement }`, `{ file, append }` or `{ file, marker, insert }`.

## Trust rules

- **No code runs.** `finalize` and any code-like field are rejected; only files, package merges and text transforms are applied.
- Symbolic links anywhere in the folder (or in a downloaded archive) are rejected; archives with absolute or `..` paths are refused. All writes still go through the normal staging checks.
- An external recipe can never replace a built-in id.
- You always see the source (and, for GitHub, the commit SHA the ref resolved to). Interactive runs ask to confirm; `-y` / `--json` additionally need `--trust-external`.
- `zealakit.json` records `externalRecipes: [{ id, source, ref?, sha? }]`; `add`, `doctor` and `outdated` re-resolve them (GitHub sources are pinned to the recorded SHA).
- GitHub sources are cached under `~/.config/zealakit/recipes` (`$ZEALAKIT_CONFIG_DIR`).
