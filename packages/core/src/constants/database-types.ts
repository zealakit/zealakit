/**
 * DB engines ORM recipes commonly target (Postgres / MySQL / SQLite).
 * MongoDB/Redis not first-class in current ORM overlays — omit for now.
 */
export const DATABASE_TYPES = ["postgresql", "mysql", "sqlite"] as const;

export type DatabaseType = (typeof DATABASE_TYPES)[number];
