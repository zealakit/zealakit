# Ecosystem coverage and consistency audit

Snapshot of the current catalog (`node` + `go`) and the representative
generated-project checks used to validate it.

## Template matrix

| Template             | Ecosystem | Scope          | Framework | Language | Dev                 | Build/check                                        | Compatible recipes | Notes                 |
| -------------------- | --------- | -------------- | --------- | -------- | ------------------- | -------------------------------------------------- | ------------------ | --------------------- |
| `vite-react`         | node      | client         | react     | TS       | `npm run dev`       | `tsc -b && vite build`, Biome/ESLint               | 12                 | SPA                   |
| `vite-vue`           | node      | client         | vue       | TS       | `npm run dev`       | `vue-tsc -b && vite build`, Biome/ESLint           | 11                 | SPA                   |
| `vite-svelte`        | node      | client         | svelte    | TS       | `vite dev`          | SvelteKit static SPA, `svelte-check`, Biome/ESLint | 7                  | SvelteKit SPA; no SSR |
| `astro-react-client` | node      | client         | react     | TS       | `npm run dev`       | Astro build, Biome                                 | 12                 | static/SSG/islands    |
| `astro-react-hybrid` | node      | hybrid         | react     | TS       | `npm run dev`       | Astro SSR build, Biome                             | 16                 | Node adapter, Actions |
| `next`               | node      | hybrid         | react     | TS       | `npm run dev`       | Next build, Biome/ESLint                           | 16                 | App Router            |
| `nuxt`               | node      | hybrid         | vue       | TS       | `npm run dev`       | Nuxt build, Biome/ESLint                           | 15                 | `app/` source root    |
| `nest`               | node      | server         | —         | TS       | `npm run start:dev` | Nest build, Biome/ESLint                           | 6                  | DDD/hexagonal         |
| `hono`               | node      | server         | —         | TS       | `npm run dev`       | Hono build, Biome/ESLint                           | 6                  | lightweight API       |
| `stdlib-api`         | go        | server         | —         | Go       | `make run`          | `go test`, `go vet`                                | 3                  | stdlib + DDD layers   |
| `gin-api`            | go        | server         | gin       | Go       | `make run`          | `go test`, `go vet`                                | 3                  | Gin                   |
| `stdlib-worker`      | go        | infrastructure | —         | Go       | `make run`          | `go test`, `go vet`                                | 3                  | background worker     |

## Recipe matrix

| Recipe                 | Ecosystem | Category                 | Dependencies                     | Compatible templates      |
| ---------------------- | --------- | ------------------------ | -------------------------------- | ------------------------- |
| `biome`                | node      | linter                   | `@biomejs/biome`                 | 9 Node templates          |
| `eslint`               | node      | linter                   | ESLint + framework plugins       | 9 Node templates          |
| `zustand`              | node      | state                    | Zustand                          | React templates (4)       |
| `pinia`                | node      | state                    | Pinia                            | Vue templates (2)         |
| `nanostores`           | node      | state                    | Nanostores                       | 7 client/hybrid templates |
| `client-shared-pieces` | node      | utils                    | none (default)                   | 7 client/hybrid templates |
| `hookform-zod`         | node      | form                     | RHF + Zod                        | React templates (4)       |
| `vee-validate-zod`     | node      | form                     | VeeValidate + Zod                | Vue templates (2)         |
| `kyjs`                 | node      | fetcher                  | Ky                               | 7 client/hybrid templates |
| `axios`                | node      | fetcher                  | Axios                            | 7 client/hybrid templates |
| `antd`                 | node      | ui                       | Ant Design                       | React templates (4)       |
| `mui`                  | node      | ui                       | MUI                              | React templates (4)       |
| `shadcn-ui`            | node      | ui                       | shadcn + Tailwind                | React templates (4)       |
| `nuxt-ui`              | node      | ui                       | Nuxt UI                          | Vue templates (2)         |
| `shadcn-vue`           | node      | ui                       | shadcn-vue + Tailwind            | Vue templates (2)         |
| `storybook`            | node      | ui/testing/documentation | Storybook framework per template | 7 client/hybrid templates |
| `type-orm`             | node      | orm                      | TypeORM + drivers                | 5 server/hybrid templates |
| `mikro-orm`            | node      | orm                      | MikroORM + drivers               | 5 server/hybrid templates |
| `drizzle-orm`          | node      | orm                      | Drizzle + drivers                | 5 server/hybrid templates |
| `prisma`               | node      | orm                      | Prisma                           | 5 server/hybrid templates |
| `postgres`             | go        | infrastructure           | `pgx/v5`                         | 3 Go templates            |
| `mysql`                | go        | infrastructure           | `go-sql-driver/mysql`            | 3 Go templates            |
| `mongodb`              | go        | infrastructure           | `mongo-driver/v2`                | 3 Go templates            |

## Compatibility and composition findings

- Ecosystem compatibility is now enforced explicitly. Go recipes cannot be
  applied to Node templates and vice versa, even when scope matches.
- Default recipes are applied by `buildScaffoldPlan`, so direct
  `scaffoldProject`/programmatic callers no longer miss `client-shared-pieces`.
- Multiple recipes coexist as expected: Biome/ESLint are exclusive;
  UI kits and state libraries are exclusive per category; Storybook is
  non-exclusive; ORMs are exclusive within `orm`.
- Dependency expansion and conflict validation remain unchanged.
- `Info` exposes the same compatibility data used by CLI and Discovery.

## Representative combinations tested

| Combination                              | Install | Check/build                       | Result                       |
| ---------------------------------------- | ------- | --------------------------------- | ---------------------------- |
| `vite-react` + biome + zustand           | pnpm    | Biome + Vite build                | Pass                         |
| `vite-vue` + biome + pinia               | pnpm    | Biome + Vue build                 | Pass                         |
| `vite-svelte` + biome                    | pnpm    | Biome + svelte-check + Vite build | Pass                         |
| `astro-react-client` + biome + shadcn-ui | pnpm    | Biome + Astro build               | Pass                         |
| `next` + biome + shadcn-ui               | pnpm    | Biome + Next build                | Pass after ambient-types fix |
| `nest` + prisma + biome                  | pnpm    | Biome + Nest build                | Pass                         |
| `hono` + drizzle-orm + biome             | pnpm    | Biome + Hono build                | Pass                         |
| `nuxt` + pinia + biome                   | pnpm    | Biome + Nuxt build                | Pass after ambient-types fix |
| Go templates + postgres/mysql/mongodb    | go mod  | tidy + test + vet                 | Pass                         |

Biome checks for fixtures under the gitignored `.sandbox/` were run with
`--vcs-enabled=false`; generated projects outside that directory use the normal
VCS ignore behavior.

## Verified defects and fixes

### P0

1. **Implicit defaults bypassed in plan/scaffold.** Direct plan/scaffold calls
   with `vite-vue` + `pinia` failed a transform because `client-shared-pieces`
   was missing. `buildScaffoldPlan` now applies `withDefaultRecipes`.
2. **Next.js missing ambient API types.** `next build` failed on shared
   `ApiGeneral*` model types. Added `src/general.d.ts`.
3. **Nuxt missing ambient API types.** Added `app/general.d.ts` for the folded
   `app/` source tree.
4. **Biome configs produced failing `pnpm check`.** Fixed line widths, Vue
   template false positives, and markdown/build-artifact inclusion for
   `vite-vue`, `nuxt`, `next`, `nest`, and `hono`.
5. **Go recipe metadata omitted dependencies.** Added `goModules` to recipe
   metadata/Info so each Go database recipe exposes its module without
   duplicating the source of truth.

### P1 / deferred

- Go database recipes do not ship a `go.sum`; run `go mod tidy` once (documented
  in each generated agent entry).
- Database package is not auto-wired into each template’s composition root.
- MySQL/SQLite and validation recipes remain deferred.
- `vite-svelte` keeps the historical `vite-svelte` id while using SvelteKit; a
  future rename would be a separate compatibility decision.
