import path from "node:path";
import { getRecipeDir } from "@zealakit/core";
import { defineGoRecipe } from "./define.js";
import { addGoRequires, appendEnvSection, mergeGoSum } from "./shared.js";

const GO_MODULES = {
  "github.com/go-sql-driver/mysql": "v1.9.3",
} as const;

export default defineGoRecipe({
  id: "mysql",
  name: "MySQL",
  hint: "database/sql + go-sql-driver/mysql",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  packages: {},
  goModules: { ...GO_MODULES },
  devDependencies: {},
  scripts: {},
  finalize(targetDir) {
    addGoRequires(targetDir, GO_MODULES, "MySQL");
    mergeGoSum(targetDir, path.join(getRecipeDir("mysql"), "scaffold", "go.sum"));
    appendEnvSection(
      targetDir,
      "DATABASE_URL",
      `# MySQL (database/sql + go-sql-driver/mysql)
DATABASE_URL=user:password@tcp(localhost:3306)/app?parseTime=true&charset=utf8mb4&loc=UTC
DB_MAX_OPEN_CONNS=10
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=30m
DB_CONNECT_TIMEOUT=5s`,
    );
  },
});
