import { MikroORM } from "@mikro-orm/core";
import { createMikroOrmOptions } from "./mikro-orm.options.js";

/**
 * Initialize MikroORM for the Hono composition root / adapters.
 * Configure driver + env before calling.
 */
export async function createMikroOrm(): Promise<MikroORM> {
  return MikroORM.init(createMikroOrmOptions() as never);
}
