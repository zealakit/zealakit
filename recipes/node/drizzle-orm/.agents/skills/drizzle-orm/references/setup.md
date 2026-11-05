# Drizzle setup

## Choose a dialect + driver (required before boot / migrations)

1. Install a client driver, for example `pg`, `mysql2`, or `better-sqlite3`.
2. Implement `createDrizzleClient()` in `drizzle.client.ts` (import the matching `drizzle-orm/*` entry).
3. Define tables in `schema.ts` with the matching core package:
   - Postgres → `drizzle-orm/pg-core`
   - MySQL → `drizzle-orm/mysql-core`
   - SQLite → `drizzle-orm/sqlite-core`
4. For drizzle-kit, set `DB_DIALECT` (`postgresql` | `mysql` | `sqlite` | …) and `DATABASE_URL`.
5. Narrow `DrizzleDb` in `drizzle.types.ts` to the real return type of `drizzle(...)`.

Scaffold leaves Nest `DrizzlePersistenceModule` / Hono `createDrizzleClient` **commented out** so the app boots without a driver. Uncomment after env + driver are ready.

## Placement

| Artifact | Path |
| --- | --- |
| Nest module | `infrastructure/persistence/drizzle/drizzle.module.ts` |
| Hono bootstrap re-export | `infrastructure/persistence/drizzle/drizzle.bootstrap.ts` |
| Client factory | `infrastructure/persistence/drizzle/drizzle.client.ts` |
| DI / composition token | `infrastructure/persistence/drizzle/drizzle.token.ts` (`DRIZZLE`) |
| Table schemas | `infrastructure/persistence/drizzle/schema.ts` |
| Kit config | `drizzle.config.ts` (repo root) |
| Migrations out dir | `infrastructure/persistence/drizzle/migrations` (via kit `out`) |
| Repository adapter | `infrastructure/persistence/<feature>/*.repository.adapter.ts` |
| Next (hybrid) | `src/lib/persistence/drizzle/` |
| Nuxt (hybrid) | `server/persistence/drizzle/` |

## Nest wiring

```typescript
// bootstrap/app.module.ts
imports: [
  DrizzlePersistenceModule, // @Global() — exports DRIZZLE
  FeatureAModule,
  FeatureBModule,
],
```

Adapters inject `@Inject(DRIZZLE) private readonly db: DrizzleDb`.

## Hono wiring

```typescript
import { createDrizzleClient } from "@/infrastructure/persistence/drizzle/drizzle.bootstrap.js";

const db = createDrizzleClient();
// pass db into repository adapters from bootstrap/modules
```

## Example client (Postgres)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type DrizzleDb = NodePgDatabase<typeof schema>;

export function createDrizzleClient(): DrizzleDb {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema });
}
```

Keep dialect, schema imports, and `drizzle-kit` `dialect` aligned — mixed Postgres tables with a MySQL kit config will fail generate/migrate.
