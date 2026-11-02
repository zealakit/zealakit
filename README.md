# Zealakit

**Recipe-based scaffolding for TypeScript projects.**

Start from a real template. Add only the pieces you need. Get a clean project with wired dependencies, scripts, and AI-agent docs — without installing the CLI globally.

```bash
npx zealakit@latest my-app
```

One command, a few questions, and you are ready to code.

---

## Why Zealakit?

Most starters give you two options: a blank project or a pile of boilerplate you did not ask for.

Zealakit lets you compose:

- **Template** — the base app (Vite + React, Next.js, NestJS, or Hono)
- **Recipes** — optional layers such as Biome, Zustand, shadcn/ui, Drizzle, Storybook

Each recipe brings its own files, dependencies, and scripts. Zealakit merges everything into one ready-to-install project.

You also get:

- A consistent, feature-based folder structure
- `.agents` skills and rules (`.cursor` → `.agents` symlink) plus `AGENTS.md` / `CLAUDE.md`
- No lock-in — generated projects are plain TypeScript apps

---

## Quick start

Requires **Node.js 18+**.

```bash
npx zealakit@latest my-app
```

No global install needed. `npx` always runs the latest version and keeps your machine clean.

The CLI asks for:

1. A base template
2. The recipes to add
3. Confirmation

Then install and run:

```bash
cd my-app
npm install
npm run dev
```

`pnpm`, `yarn`, and `bun` work too — Zealakit does not install packages for you.

### Non-interactive

```bash
npx zealakit@latest my-app -t next -w biome,shadcn-ui,storybook -y
```

```bash
npx zealakit@latest api -t nest -w biome,drizzle-orm -y
```

Without `-w`, the CLI runs the interactive flow. Add `-y` with a project name to skip prompts entirely.

---

## CLI options

```
npx zealakit@latest [project-name] [options]
```

| Option | Description |
| --- | --- |
| `-t, --template <id>` | Base template. Default: `vite-react` |
| `-w, --with <recipes>` | Comma-separated recipe IDs, e.g. `biome,zustand` |
| `-y, --yes` | Non-interactive. Requires a project name |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

**Behavior notes**

- Project names must follow npm naming rules (lowercase, no spaces).
- An existing non-empty folder asks for confirmation before overwriting.
- With `-y`, an existing non-empty folder is rejected instead of overwritten.
- Invalid recipes, conflicting recipes, and incompatible scopes are caught **before** any files are written.

---

## Templates

| ID | Scope | Stack |
| --- | --- | --- |
| `vite-react` | client | Vite + React 19 + TypeScript + React Router + i18next |
| `next` | hybrid | Next.js App Router + TypeScript + next-intl |
| `nest` | server | NestJS + TypeScript + DDD / hexagonal architecture |
| `hono` | server | Hono + TypeScript + DDD / hexagonal architecture |

Every template includes:

- Feature-based folders and a working sample feature
- `@/*` path alias
- `.agents/` skills and rules (`.cursor` symlink for Cursor)
- `AGENTS.md` and `CLAUDE.md` for AI coding assistants

Start commands:

| Template | Dev command |
| --- | --- |
| `vite-react` | `npm run dev` |
| `next` | `npm run dev` |
| `nest` | `npm run start:dev` |
| `hono` | `npm run dev` |

---

## Recipes

Pick **one** recipe per category. `storybook` is the exception — it can sit beside any UI kit. `client-shared-pieces` is added automatically on client and hybrid projects.

| Recipe | Category | Works with | What it adds |
| --- | --- | --- | --- |
| `biome` | Linter | All | Fast lint + format, `check` scripts |
| `eslint` | Linter | All | ESLint flat config, `lint` scripts |
| `zustand` | State | Vite, Next | Typed Zustand store example |
| `nanostores` | State | Vite, Next | Typed Nanostores store example |
| `hookform-zod` | Forms | Vite, Next | React Hook Form + Zod, example schema and types |
| `kyjs` | HTTP | Vite, Next | Ky client with token refresh on 401 |
| `axios` | HTTP | Vite, Next | Axios client with token refresh on 401 |
| `antd` | UI + ui-react | Vite, Next | ConfigProvider, theme tokens, UI wrappers |
| `mui` | UI + ui-react | Vite, Next | ThemeProvider, theme tokens, UI wrappers |
| `shadcn-ui` | UI + ui-react | Vite, Next | Tailwind v4, shadcn/ui (base-vega), lucide icons, `cn` helper |
| `storybook` | UI + docs + testing | Vite, Next | `.storybook` config and Storybook scripts (shared `ui` tag) |
| `type-orm` | Database | Nest, Hono | TypeORM persistence adapter |
| `mikro-orm` | Database | Nest, Hono | MikroORM persistence adapter |
| `drizzle-orm` | Database | Nest, Hono | Drizzle persistence adapter and migration scripts |
| `client-shared-pieces` | Shared | Vite, Next | i18n, API layer, constants, hooks, layouts *(automatic)* |

Database recipes do **not** pin a driver. Install the driver for your target database (`pg`, `mysql2`, `better-sqlite3`, …) and follow the generated skill.

### Recipe examples

```bash
# SPA with Biome, Zustand, forms, and a Ky client
npx zealakit@latest web -t vite-react -w biome,zustand,hookform-zod,kyjs -y

# Next.js with shadcn/ui and Storybook
npx zealakit@latest next-web -t next -w biome,shadcn-ui,storybook -y

# NestJS API with Drizzle
npx zealakit@latest api-nest -t nest -w biome,drizzle-orm -y

# Hono API with TypeORM
npx zealakit@latest api-hono -t hono -w biome,type-orm -y
```

---

## What you get

```text
my-app/
├─ src/                 # Application code
├─ .agents/             # Skills and rules for AI assistants
├─ .cursor -> .agents   # Symlink for Cursor IDE
├─ AGENTS.md            # Guidance for coding agents
├─ CLAUDE.md
├─ package.json         # Merged dependencies and scripts
└─ tsconfig.json
```

Use any package manager (`npm`, `pnpm`, `yarn`, `bun`, …) — Zealakit does not pin one.

Recipe overlays are applied on top of the template, so the result is a single normal project — no runtime dependency on Zealakit.

---

## How it works

1. **Copy the template** into a new folder.
2. **Apply recipes** — shared files first, then the template-specific overlay.
3. **Merge metadata** — dependencies, dev dependencies, and scripts into `package.json`.
4. **Apply transforms** — surgical edits such as wrapping `<App />` with a theme provider.
5. **Add agent notes** — recipe guidance is inserted into `AGENTS.md` and `CLAUDE.md`.

Inputs are validated before any files are written, so invalid names, recipes, and combinations fail fast.

---

## Local development

This repository is the kit itself, not a generated app.

```bash
pnpm install
pnpm dev          # watch-build the CLI
pnpm build        # build dist/
pnpm check        # Biome check
pnpm test:pack    # build, npm pack, run E2E scenarios
pnpm monitor      # internal dependency dashboard
```

### Repository layout

| Path | Role |
| --- | --- |
| `src/` | CLI source: registry, prompts, validator, scaffolder |
| `src/registry/` | Template and recipe metadata |
| `templates/<id>/` | Base apps shipped with the package |
| `recipes/<id>/` | Optional overlays, shared files, and agent skills |
| `scripts/test-e2e-pack.ts` | Packed-package end-to-end tests |
| `monitor/` | Maintainer dependency dashboard |

Run the CLI from source:

```bash
pnpm build
node dist/index.js my-app -t vite-react -w biome -y
```

Or test a local package:

```bash
npm pack
npx --yes --package=./zealakit-<version>.tgz zealakit my-app -w biome -y
```

### Adding a template or recipe

- **Template:** add `templates/<id>/`, then register it in `src/registry/templates.ts`.
- **Recipe:** add `recipes/<id>/`, register it in `src/registry/recipes.ts`, then add an overlay for every supported template.
- **New category or scope:** update `src/constants.ts` first.

See [.agents/skills/zealakit/extending.md](.agents/skills/zealakit/extending.md) for the full checklist.

---

## FAQ

**Does Zealakit install dependencies?**
No. It writes files and `package.json`, then you choose your package manager.

**Can I use more than one linter, state library, or UI kit?**
No. Those categories are exclusive, and the CLI rejects conflicts. Storybook is the exception.

**Can I change the generated code?**
Yes. It is a normal project. Zealakit is only used once, at scaffold time.

**Does it support monorepos?**
Not yet. Each run creates one standalone project.

---

## License

[MIT](LICENSE)

Source: [github.com/zealamic/zealakit](https://github.com/zealamic/zealakit)
