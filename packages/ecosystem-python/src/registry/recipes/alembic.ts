import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "alembic",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api"],
    databases: ["postgresql", "sqlite"],
  },
  name: "Alembic",
  hint: "Database migrations for SQLAlchemy",
  category: "infrastructure",
  supportedScopes: ["server"],
  exclusive: false,
  dependsOn: ["sqlalchemy"],
  dependencies: { alembic: ">=1.13" },
  fileTransforms: {
    "fastapi-api": [
      {
        file: "src/app/infrastructure/persistence/database.py",
        pattern: /AUTO_CREATE_TABLES = True/,
        replacement: "AUTO_CREATE_TABLES = False",
      },
    ],
  },
});
