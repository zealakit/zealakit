import fs from "node:fs";
import {
  assertStagingRealPath,
  type FinalizeContext,
  resolveStagingPath,
} from "@zealakit/core/ecosystem";
import { defineRecipe } from "./define.js";

const ORM_RECIPES = ["prisma", "drizzle-orm", "type-orm", "mikro-orm"];

/** compose.yaml with a Postgres `db` service wired to the app via DATABASE_URL. */
export const COMPOSE_WITH_DB = `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: "3000"
      # Postgres by default; change the image and this URL together for MySQL.
      DATABASE_URL: postgres://postgres:postgres@db:5432/app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  db-data:
`;

export function hasOrmRecipe(recipeIds: readonly string[]): boolean {
  return recipeIds.some((id) => ORM_RECIPES.includes(id));
}

function finalizeCompose(targetDir: string, { config }: FinalizeContext): void {
  if (!hasOrmRecipe(config.recipeIds)) return;
  const file = resolveStagingPath(targetDir, "compose.yaml");
  if (fs.existsSync(file)) assertStagingRealPath(targetDir, file);
  fs.writeFileSync(file, COMPOSE_WITH_DB, "utf-8");
}

export default defineRecipe({
  id: "docker",
  discovery: { capabilities: [], projectTypes: ["server-api", "ui"] },
  name: "Docker",
  hint: "Multi-stage Dockerfile + compose (adds a db service with an ORM)",
  category: "infrastructure",
  supportedScopes: ["server", "hybrid"],
  exclusive: false,
  fileTransforms: {
    next: [
      {
        file: "next.config.ts",
        pattern: /reactCompiler: true,/,
        replacement: 'reactCompiler: true,\n  output: "standalone",',
      },
    ],
  },
  finalize: finalizeCompose,
});
