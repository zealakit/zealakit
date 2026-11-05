import { DataSource } from "typeorm";
import { createTypeOrmDataSourceOptions } from "./typeorm.options.js";

/**
 * Shared DataSource factory for Hono composition.
 * Call from repository adapters or bootstrap after configuring env + driver.
 */
export function createTypeOrmDataSource(): DataSource {
  return new DataSource(createTypeOrmDataSourceOptions());
}
