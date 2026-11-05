import { ReflectMetadataProvider } from "@mikro-orm/decorators/legacy";
import { DatabaseDriver } from "./mikro-orm.driver.js";

/**
 * Driver-agnostic MikroORM options.
 * Configure `DatabaseDriver` in `mikro-orm.driver.ts`, then set connection env:
 * `DATABASE_URL` and/or `DB_NAME` (+ host credentials as needed).
 */
export function createMikroOrmOptions(): Record<string, unknown> {
  if (!DatabaseDriver) {
    throw new Error(
      "MikroORM driver is not set: edit lib/persistence/mikro-orm/mikro-orm.driver.ts and install @mikro-orm/postgresql | mysql | sqlite | …. See .agents/skills/mikro-orm/SKILL.md.",
    );
  }

  const clientUrl = process.env.DATABASE_URL?.trim();
  const dbName = process.env.DB_NAME?.trim();

  if (!clientUrl && !dbName) {
    throw new Error(
      "MikroORM is not configured: set DATABASE_URL or DB_NAME. See .agents/skills/mikro-orm/SKILL.md.",
    );
  }

  return {
    driver: DatabaseDriver,
    ...(clientUrl ? { clientUrl } : {}),
    ...(dbName ? { dbName } : {}),
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    entities: ["./dist/**/*.orm-entity.js"],
    entitiesTs: ["./src/**/*.orm-entity.ts"],
    metadataProvider: ReflectMetadataProvider,
  };
}
