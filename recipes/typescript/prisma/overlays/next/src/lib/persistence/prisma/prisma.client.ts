import type { PrismaClientLike } from "./prisma.types.js";

/**
 * Build the Prisma client after schema + env are ready (Prisma 7+).
 *
 * 1. Set `provider` in `prisma/schema.prisma`
 * 2. Set `DATABASE_URL` (used by `prisma.config.ts` for CLI + by your adapter at runtime)
 * 3. Run `pnpm db:generate`
 * 4. Install a driver adapter for your DB (e.g. `pg` + `@prisma/adapter-pg`) and implement:
 *
 *   import { PrismaClient } from "@prisma/client";
 *   import { PrismaPg } from "@prisma/adapter-pg";
 *   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
 *   return new PrismaClient({ adapter });
 */
export function createPrismaClient(): PrismaClientLike {
  throw new Error(
    "Prisma client is not configured: implement createPrismaClient() with a driver adapter after `prisma generate`. See .agents/skills/prisma/SKILL.md.",
  );
}
