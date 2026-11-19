import path from "node:path";
import { getRecipeDir } from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";
import { addGoRequires, appendEnvSection, mergeGoSum } from "./shared.js";

const GO_MODULES = {
  "github.com/jackc/pgx/v5": "v5.7.4",
} as const;

export default defineGoRecipe({
  id: "postgres",
  discovery: {
    capabilities: ["database"],
    projectTypes: ["server-api", "background-worker"],
    databases: ["postgresql"],
  },
  name: "PostgreSQL",
  hint: "database/sql + pgx stdlib driver",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  goModules: { ...GO_MODULES },
  finalize(targetDir) {
    addGoRequires(targetDir, GO_MODULES, "PostgreSQL");
    mergeGoSum(targetDir, path.join(getRecipeDir("postgres"), "scaffold", "go.sum"));
    appendEnvSection(
      targetDir,
      "DATABASE_URL",
      `# PostgreSQL (database/sql + pgx stdlib driver)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app?sslmode=disable
DB_MAX_OPEN_CONNS=10
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=30m
DB_CONNECT_TIMEOUT=5s`,
    );
  },
});
