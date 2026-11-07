/**
 * Pick one MikroORM driver package, then export it as `DatabaseDriver`.
 *
 * Examples (uncomment one after installing the package):
 *
 *   export { PostgreSqlDriver as DatabaseDriver } from "@mikro-orm/postgresql";
 *   export { MySqlDriver as DatabaseDriver } from "@mikro-orm/mysql";
 *   export { SqliteDriver as DatabaseDriver } from "@mikro-orm/sqlite";
 *
 * Leave unset until the database is chosen — the persistence module will throw
 * a clear error at boot.
 */
export const DatabaseDriver: unknown = undefined;
