import type { DataSourceOptions } from "typeorm";

/**
 * Driver-agnostic TypeORM DataSource options from env.
 *
 * 1. Install a driver for your database, e.g. `pg`, `mysql2`, or `better-sqlite3`
 * 2. Set `DB_TYPE` to the TypeORM driver name (`postgres`, `mysql`, `better-sqlite3`, …)
 * 3. Set `DATABASE_URL` **or** `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
 */
export function createTypeOrmDataSourceOptions(): DataSourceOptions {
  const type = process.env.DB_TYPE?.trim();
  if (!type) {
    throw new Error(
      "TypeORM is not configured: set DB_TYPE and DATABASE_URL (or DB_HOST/DB_NAME/…). See .agents/skills/type-orm/SKILL.md.",
    );
  }

  const synchronize = process.env.DB_SYNCHRONIZE === "true";
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    return {
      type: type as DataSourceOptions["type"],
      url,
      synchronize,
      entities: ["./dist/**/*.orm-entity.js"],
    };
  }

  const database = process.env.DB_NAME?.trim();
  if (!database) {
    throw new Error(
      "TypeORM is not configured: set DATABASE_URL or DB_NAME (with host credentials). See .agents/skills/type-orm/SKILL.md.",
    );
  }

  return {
    type: type as DataSourceOptions["type"],
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    synchronize,
    entities: ["./dist/**/*.orm-entity.js"],
  };
}
