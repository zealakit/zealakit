import { defineConfig } from "drizzle-kit";

const dialect = process.env.DB_DIALECT?.trim();
const url = process.env.DATABASE_URL?.trim();

if (!dialect || !url) {
  throw new Error(
    "drizzle-kit needs DB_DIALECT (postgresql | mysql | sqlite | …) and DATABASE_URL. See .agents/skills/drizzle-orm/SKILL.md.",
  );
}

export default defineConfig({
  schema: "./src/lib/persistence/drizzle/schema.ts",
  out: "./src/lib/persistence/drizzle/migrations",
  dialect,
  dbCredentials: {
    url,
  },
});
