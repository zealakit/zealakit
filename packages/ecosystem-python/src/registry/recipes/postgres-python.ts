import { appendEnvSection } from "../shared.js";
import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "postgres-python",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api", "background-worker"],
    databases: ["postgresql"],
  },
  name: "PostgreSQL",
  hint: "psycopg 3 driver and DATABASE_URL",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: false,
  dependencies: { "psycopg[binary]": ">=3.2" },
  finalize(targetDir) {
    appendEnvSection(
      targetDir,
      "DATABASE_URL",
      `# PostgreSQL (SQLAlchemy URL, psycopg 3)
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/app`,
    );
  },
});
