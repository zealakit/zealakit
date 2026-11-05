import { defineConfig, env } from "prisma/config";

/**
 * Prisma CLI config (migrate / studio / generate datasource).
 * Set DATABASE_URL in the environment (or a root `.env` loaded by your shell/tooling).
 * Runtime PrismaClient still needs a driver adapter — see prisma.client.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
