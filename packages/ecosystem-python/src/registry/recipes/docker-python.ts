import type { FinalizeContext } from "@zealakit/core/ecosystem";
import { writeStagedFile } from "../shared.js";
import { defineRecipe } from "./define.js";

const PORTS: Record<string, number | undefined> = {
  "fastapi-api": 8000,
  "python-worker": undefined,
};

/** compose.yaml for a template, with a Postgres `db` service when `postgres-python` is selected. */
export function composeFor(templateId: string, recipeIds: readonly string[]): string {
  const port = PORTS[templateId];
  const database = recipeIds.includes("postgres-python");
  const app = ["  app:", "    build: ."];
  if (port) app.push("    ports:", `      - "${port}:${port}"`);
  if (database) {
    app.push(
      "    environment:",
      '      DATABASE_URL: "postgresql+psycopg://postgres:postgres@db:5432/app"',
      "    depends_on:",
      "      db:",
      "        condition: service_healthy",
    );
  }
  const lines = ["services:", ...app];
  if (database) {
    lines.push(
      "",
      "  db:",
      "    image: postgres:17-alpine",
      "    environment:",
      "      POSTGRES_PASSWORD: postgres",
      "      POSTGRES_DB: app",
      "    ports:",
      '      - "5432:5432"',
      "    healthcheck:",
      '      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]',
      "      interval: 5s",
      "      timeout: 3s",
      "      retries: 10",
    );
  }
  return `${lines.join("\n")}\n`;
}

export default defineRecipe({
  id: "docker-python",
  discovery: { capabilities: [], projectTypes: ["server-api", "background-worker"] },
  name: "Docker",
  hint: "Multi-stage uv Dockerfile + compose (adds a db service with postgres-python)",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: false,
  finalize(targetDir: string, { config }: FinalizeContext) {
    writeStagedFile(targetDir, "compose.yaml", composeFor(config.templateId, config.recipeIds));
  },
});
