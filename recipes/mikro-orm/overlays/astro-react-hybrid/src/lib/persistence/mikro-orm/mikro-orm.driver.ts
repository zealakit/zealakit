/**
 * Assign a MikroORM driver class after installing the matching package, e.g.:
 *
 *   import { PostgreSqlDriver } from "@mikro-orm/postgresql";
 *   export const DatabaseDriver = PostgreSqlDriver;
 *
 * Leave `undefined` until a driver is chosen — options factory will throw with guidance.
 */
export const DatabaseDriver: unknown = undefined;
