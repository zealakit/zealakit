# Prisma setup

## Choose a provider + env (required before boot / migrations)

1. Set `provider` in `prisma/schema.prisma` (`postgresql`, `mysql`, `sqlite`, …). **Do not put `url` in the schema** (Prisma 7+).
2. Set `DATABASE_URL` in the environment. CLI reads it from `prisma.config.ts`.
3. Run `pnpm db:generate` so `@prisma/client` matches the schema.
4. Install a **driver adapter** for your DB (e.g. `pg` + `@prisma/adapter-pg`).
5. Implement `createPrismaClient()` with `new PrismaClient({ adapter })`.
6. Narrow `PrismaClientLike` in `prisma.types.ts` to `PrismaClient`.

Scaffold leaves Nest `PrismaPersistenceModule` / Hono `createPrismaClient` **commented out** so the app boots without a live database. Uncomment after env + generate + adapter are ready.

## Placement

| Artifact | Path |
| --- | --- |
| Nest module | `infrastructure/persistence/prisma/prisma.module.ts` |
| Hono bootstrap re-export | `infrastructure/persistence/prisma/prisma.bootstrap.ts` |
| Client factory | `infrastructure/persistence/prisma/prisma.client.ts` |
| DI / composition token | `infrastructure/persistence/prisma/prisma.token.ts` (`PRISMA`) |
| Schema | `prisma/schema.prisma` (provider only) |
| CLI config | `prisma.config.ts` (repo root — `datasource.url`) |
| Migrations | `prisma/migrations` (created by Prisma Migrate) |
| Repository adapter | `infrastructure/persistence/<feature>/*.repository.adapter.ts` |
| Next (hybrid) | `src/lib/persistence/prisma/` |
| Nuxt (hybrid) | `server/persistence/prisma/` |

## Nest wiring

```typescript
// bootstrap/app.module.ts
imports: [
  PrismaPersistenceModule, // @Global() — exports PRISMA
  FeatureAModule,
  FeatureBModule,
],
```

Adapters inject `@Inject(PRISMA) private readonly prisma: PrismaClient`.

## Hono wiring

```typescript
import { createPrismaClient } from "@/infrastructure/persistence/prisma/prisma.bootstrap.js";

const prisma = createPrismaClient();
// pass prisma into repository adapters from bootstrap/modules
```

## Runtime client (PostgreSQL example)

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
return new PrismaClient({ adapter });
```
