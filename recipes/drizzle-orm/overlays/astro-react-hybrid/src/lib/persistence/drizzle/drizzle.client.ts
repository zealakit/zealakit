import type { DrizzleDb } from "./drizzle.types.js";

/**
 * Build the Drizzle client for your chosen database.
 *
 * 1. Install a driver (`pg`, `mysql2`, `better-sqlite3`, …)
 * 2. Define tables with the matching dialect (`drizzle-orm/pg-core`, `mysql-core`, or `sqlite-core`)
 * 3. Return `drizzle(client, { schema })` from this factory
 *
 * Examples (after installing the driver):
 *
 *   import { drizzle } from "drizzle-orm/node-postgres";
 *   import { Pool } from "pg";
 *   import * as schema from "./schema.js";
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   return drizzle(pool, { schema });
 */
export function createDrizzleClient(): DrizzleDb {
  throw new Error(
    "Drizzle client is not configured: implement createDrizzleClient() in lib/persistence/drizzle/drizzle.client.ts and install a DB driver. See .agents/skills/drizzle-orm/SKILL.md.",
  );
}
