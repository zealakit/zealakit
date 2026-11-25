# Dependency Monitor

Local web dashboard for viewing, comparing, and updating dependency versions in the **Zealakit** pnpm monorepo — the kit packages, the Node templates it ships, and the npm versions its recipes write into generated projects.

It is synced with the Zealakit Overlay monitor (same architecture, row model, registry
classification, safety rules, review dialog, and check + auto-upgrade AI prompts). Zealakit-specific
adaptations:

- Scope is wider: `apps/*`, `templates/node/*`, and **recipe registry modules** are monitored, not only `packages/*`.
- Recipe versions live in TypeScript (`defineRecipe({ packages, devDependencies, overlayPackages, overlayDevDependencies })`), so recipe updates edit that source in place.
- Cards carry tags: template **scope** and recipe **categories**; a **Kind** filter (root / workspace / template / recipe) is added.
- The server imports `@zealakit/core` / `@zealakit/ecosystem-node`, so it runs with `tsx`, not `node --strip-types`.

## What it does

- Scans root `package.json`, every `apps/*/package.json`, every `packages/*/package.json`, every `templates/node/*/package.json`, and every registered Node recipe module
- Shows declared ranges, lockfile-resolved versions (package.json manifests), and npm registry latest/patch/minor/major
- Groups dependencies into **one card per manifest**: Root → workspace packages → templates (by scope) → recipes (by category)
- Lets you pick a target version per row and update individually or in bulk
- Generates an **AI check prompt** and an **AI auto-upgrade prompt** (copy/paste into an external coding agent) — never calls an AI API itself

## What it never does

- Scan or modify `templates/go/**` (no npm manifests), `tests/**`, `scripts/**`, `.sandbox/**`, `dist/**`
- Publish to npm
- Auto-upgrade on server start
- Accept arbitrary filesystem paths or shell commands from the browser
- Edit lockfiles by hand (lockfile refresh goes through `pnpm install`)
- Run `pnpm install` for recipe edits (recipe versions are scaffold-time data, not installed in this workspace)

## Layout

```text
monitor/
├── index.html      # Dashboard UI (served at GET /)
├── server.ts       # Local HTTP API + filesystem / registry / pnpm ops
├── tsconfig.json   # Typecheck for server.ts (part of `pnpm typecheck`)
└── README.md       # This file
```

Root script: `"monitor": "tsx monitor/server.ts"`.

## Start

```bash
pnpm monitor
```

Open **http://127.0.0.1:4177** (localhost only). If the port is taken (for example by the Overlay or css-doctor monitor), the server tries the next ports up to `+20`.

Typecheck:

```bash
pnpm exec tsc --noEmit -p monitor/tsconfig.json
```

## Monitoring scope

| Manifest id                      | Kind      | Source file                                            | Write path                                                      |
| -------------------------------- | --------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| `.`                              | root      | `package.json`                                         | JSON write + `pnpm install`                                     |
| `apps/<name>`, `packages/<name>` | workspace | `<id>/package.json`                                    | JSON write + `pnpm install`                                     |
| `templates/node/<id>`            | template  | `<id>/package.json`                                    | JSON write + `pnpm install` (templates are workspace importers) |
| `recipe/<id>`                    | recipe    | `packages/ecosystem-node/src/registry/recipes/<id>.ts` | In-place edit of the version string only                        |

Discovery is **explicit**: root + readdir of `apps/`, `packages/`, `templates/node/`, plus the registered recipe list (`RECIPE_LIST`). Do not replace this with a recursive “find every package.json” walk.

Recipe rows are read from the module source on every request (never from the in-process import), so the dashboard always shows what is on disk after an edit.

## Data model (API rows)

| Field         | Description                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `{manifestId}::{depType}[@{overlay}]::{dependency}`                                                                                           |
| `dependency`  | Package name on npm                                                                                                                           |
| `manifestId`  | See scope table                                                                                                                               |
| `packageName` | `name` from the manifest (recipe id for recipes)                                                                                              |
| `kind`        | `root` \| `workspace` \| `template` \| `recipe`                                                                                               |
| `depType`     | `dependencies` \| `devDependencies` \| `peerDependencies` \| `optionalDependencies` (recipes: `dependencies` = `packages`, `devDependencies`) |
| `overlay`     | Recipe overlay family for `overlayPackages` / `overlayDevDependencies` (e.g. `next`), else `null`                                             |
| `declared`    | Version range/string                                                                                                                          |
| `resolved`    | Lockfile version for package.json manifests; `null` for recipes                                                                               |
| `ecosystem`   | Always `"node"`                                                                                                                               |
| `local`       | `true` for `workspace:` / `file:` / `link:` / `portal:` / `catalog:` / git-url specs                                                          |
| `registry`    | Latest/patch/minor/major, version list, deprecated flag, classification, optional error                                                       |

Classifications (`up-to-date`, `patch-available`, `minor-available`, `major-available`, `deprecated`, `registry-check-failed`, `skipped`) and summary counting (unique dependency names, worst classification wins) are identical to the Overlay monitor.

## HTTP API

| Method | Path                  | Purpose                                                                                |
| ------ | --------------------- | -------------------------------------------------------------------------------------- |
| `GET`  | `/`                   | Serve `index.html`                                                                     |
| `GET`  | `/api/packages`       | Monitored manifests (`kind`, `tags`, `tagKind`, `relativePath`) + scope/category order |
| `GET`  | `/api/dependencies`   | All rows + `summary`                                                                   |
| `GET`  | `/api/summary`        | Counters only                                                                          |
| `POST` | `/api/refresh`        | Clear registry cache, reload rows                                                      |
| `GET`  | `/api/versions?name=` | Registry info for one package                                                          |
| `POST` | `/api/update`         | Update one declaration                                                                 |
| `POST` | `/api/update-bulk`    | Update many declarations                                                               |

### Update payload

```json
{
  "manifestId": "recipe/mui",
  "dependency": "@emotion/server",
  "depType": "dependencies",
  "overlay": "next",
  "targetVersion": "11.11.1",
  "preserveRange": true,
  "dryRun": false,
  "allowMajor": false
}
```

| Field           | Notes                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `manifestId`    | Must match a discovered manifest                                                                |
| `overlay`       | Recipe manifests only; selects `overlayPackages.<overlay>` / `overlayDevDependencies.<overlay>` |
| `targetVersion` | Exact semver (no path/`..`/whitespace); `^`/`~` re-applied when `preserveRange` is true         |
| `dryRun`        | Plan only; returns `from` / `to`, no writes                                                     |
| `allowMajor`    | Bulk major bumps refused unless `true`                                                          |

Update flow:

- **package.json manifests:** validate → back up text → write → `pnpm install` at repo root → on failure restore the backup and return the error. `pnpm install` honours `minimumReleaseAge` in `pnpm-workspace.yaml`, so a too-new release fails and is rolled back.
- **Recipe modules:** validate → locate the `defineRecipe({ … })` block → locate the bucket (`packages`, `devDependencies`, or the overlay entry) → replace only that version string. No install.

## UI behavior

Same as the Overlay monitor (Refresh Data, Get AI Check Prompt, Get AI Upgrade Prompt, Update All Outdated review dialog, per-row target select, conservative defaults, majors never silent), plus:

- **Kind** filter (root / workspace packages / templates / recipes)
- Card tags: `template` + scope (`client`, `hybrid`, `server`) or `recipe` + categories (`ui`, `orm`, …)
- Type column shows recipe overlay buckets as `dependencies · next`
- Current column shows the lockfile-resolved version when it differs from the declared range

## AI prompt feature

Both prompts are generated client-side; the monitor never calls an AI API and writes nothing until an external agent acts on the pasted text. Scope rules are unchanged: selected outdated rows, otherwise outdated rows in the current filter view.

Zealakit-specific content in `buildPrompt()`:

| Block                    | Zealakit value                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity                 | Zealakit repository; published root `zealakit` package bundling `dist` + `templates/` + `recipes/`                                                                             |
| Package / template lists | from `/api/packages` (`publishedPackageList()`, `templateList()`)                                                                                                              |
| Architecture             | core ecosystem-independent ← `ecosystem-*` ← `apps/cli`; templates/recipes are data                                                                                            |
| Inventory                | `Kind` column instead of `Ecosystem`; Type includes the recipe overlay                                                                                                         |
| Upgrade write path       | root/apps/packages/templates `package.json` + recipe buckets in `registry/recipes/<id>.ts`, then `pnpm install`                                                                |
| Verification             | `pnpm build` → `pnpm typecheck` → `pnpm test` (includes scaffold suites for every template/recipe) → `pnpm check` (Oxlint + Oxfmt); plus a sandbox build per affected template |
| Investigation            | recipe ↔ template framework majors, overlays and `fileTransforms` still matching template source, tsup bundle / `pnpm test:pack`                                               |
| Constraints              | no `dist/`, `.sandbox/`, `templates/go/**`; keep recipe versions compatible with templates; respect `minimumReleaseAge`                                                        |

Find leftover strings from other ports before shipping changes:

```bash
grep -n "overlay-core\|Overlay repository\|examples/\|pnpm lint\|css-doctor" monitor/index.html
```

## Security model

- Bind `127.0.0.1` only; reject non-local `Host` headers (403)
- Writes only to discovered manifests / registered recipe modules (no client-supplied paths)
- `overlay` must be a plain identifier and is only accepted for recipe manifests
- `execFile` with fixed argv (`pnpm install`) — no user-controlled shell strings
- Registry failures surface as `registry-check-failed`, never as “up to date”

## Acceptance checklist

1. `pnpm monitor` serves the UI on localhost
2. Root, `apps/cli`, `packages/*`, 9 Node templates, and 20 recipes appear; Go templates and tests do not
3. Recipe rows equal the registry data (`RECIPE_LIST` packages/devDependencies/overlay buckets)
4. `POST /api/update` with `"dryRun": true` returns `from`/`to` without writing (package.json and recipe rows)
5. A real recipe update changes only that version string and the next load shows it
6. Failed `pnpm install` restores the previous `package.json`
7. Non-local `Host` → 403
8. Both prompt modes copy text and do not mutate files

## Current Zealakit defaults

| Setting         | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Package manager | pnpm (`packageManager` in root `package.json`)                                                           |
| Scope           | root + `apps/cli` + `packages/{core,ecosystem-node,ecosystem-go}` + `templates/node/*` + recipe registry |
| Excluded        | `templates/go/**`, `tests/**`, `scripts/**`, `.sandbox/**`, `dist/**`                                    |
| URL             | http://127.0.0.1:4177 (was 4000 before the sync)                                                         |
| Runner          | `tsx monitor/server.ts`                                                                                  |
