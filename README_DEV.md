# Zealakit — maintainer notes

Developer-facing notes for working on this repository. End-user docs live in [README.md](README.md).

## Metadata for tooling

```bash
npx zealakit@latest info --json   # alias: zealakit --info --json
```

Prints a single JSON document on stdout (nothing else): CLI name/version, templates (with their prompt flow and default recipes), categories, recipes (compatible templates, conflicts, packages), and compatibility rules. Keys are stable ids; `schemaVersion` changes only on breaking changes. Without `--json`, prints a human-readable summary.

## Repository layout

This repo is a pnpm monorepo. The published npm package remains **`zealakit`** (root); workspace packages are private and bundled into `dist/`.

```text
apps/cli/                         # CLI entry (prompts, flags, UX, doctor)
packages/core/                    # Ecosystem-independent scaffold engine
packages/ecosystem-node/          # Node registry + npm package.json adapter
packages/ecosystem-go/            # Optional Go toolchain detection
templates/node/<id>/              # Node base templates
templates/go/stdlib-api/          # Go stdlib HTTP API template
templates/go/gin-api/             # Go Gin HTTP API template
templates/go/stdlib-worker/       # Go stdlib background worker
recipes/node/<id>/                # Node recipes
recipes/go/                       # Reserved (no Go recipes yet)
```

Check the environment (Go is optional; TypeScript workflows work without it):

```bash
npx zealakit@latest doctor
npx zealakit@latest doctor --json
```
