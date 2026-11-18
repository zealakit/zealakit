import fs from "node:fs";
import {
  assertStagingRealPath,
  type FinalizeContext,
  resolveStagingPath,
} from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";

type Database = {
  recipe: string;
  service: string;
  env: Record<string, string>;
};

const DATABASES: Database[] = [
  {
    recipe: "postgres",
    service: `    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
      interval: 5s
      timeout: 3s
      retries: 10`,
    env: { DATABASE_URL: "postgres://postgres:postgres@db:5432/app?sslmode=disable" },
  },
  {
    recipe: "mysql",
    service: `    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: app
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-ppassword"]
      interval: 5s
      timeout: 3s
      retries: 10`,
    env: { DATABASE_URL: "root:password@tcp(db:3306)/app?parseTime=true&charset=utf8mb4&loc=UTC" },
  },
  {
    recipe: "mongodb",
    service: `    image: mongo:7
    ports:
      - "27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 3s
      retries: 10`,
    env: { MONGODB_URI: "mongodb://db:27017", MONGODB_DATABASE: "app" },
  },
];

const TEMPLATE_PORTS: Record<string, { env: string; port: number } | undefined> = {
  "stdlib-api": { env: "HTTP_PORT", port: 8080 },
  "gin-api": { env: "APP_PORT", port: 8080 },
  "stdlib-worker": undefined,
};

/** compose.yaml for `templateId`, with a `db` service when a database recipe is selected. */
export function composeFor(templateId: string, recipeIds: readonly string[]): string {
  const http = TEMPLATE_PORTS[templateId];
  const database = DATABASES.find((candidate) => recipeIds.includes(candidate.recipe));

  const app = ["  app:", "    build: ."];
  if (http) {
    app.push("    ports:", `      - "${http.port}:${http.port}"`);
  }
  const environment: string[] = [];
  if (http) environment.push(`      ${http.env}: "${http.port}"`);
  for (const [key, value] of Object.entries(database?.env ?? {})) {
    environment.push(`      ${key}: "${value}"`);
  }
  if (environment.length > 0) app.push("    environment:", ...environment);
  if (database) {
    app.push("    depends_on:", "      db:", "        condition: service_healthy");
  }

  const lines = ["services:", ...app];
  if (database) lines.push("", "  db:", database.service);
  return `${lines.join("\n")}\n`;
}

function finalizeCompose(targetDir: string, { config }: FinalizeContext): void {
  const file = resolveStagingPath(targetDir, "compose.yaml");
  if (fs.existsSync(file)) assertStagingRealPath(targetDir, file);
  fs.writeFileSync(file, composeFor(config.templateId, config.recipeIds), "utf-8");
}

export default defineGoRecipe({
  id: "docker-go",
  discovery: { capabilities: [], projectTypes: ["server-api", "background-worker"] },
  name: "Docker",
  hint: "Multi-stage Dockerfile + compose (adds a db service with a database recipe)",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: false,
  finalize: finalizeCompose,
});
