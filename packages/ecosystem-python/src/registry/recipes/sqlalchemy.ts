import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "sqlalchemy",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api"],
    databases: ["postgresql", "sqlite"],
  },
  name: "SQLAlchemy",
  hint: "SQLAlchemy 2 ORM with a repository adapter (SQLite by default)",
  category: "orm",
  supportedScopes: ["server"],
  exclusive: true,
  dependencies: { sqlalchemy: ">=2.0" },
  fileTransforms: {
    "fastapi-api": [
      {
        file: "src/app/bootstrap/container.py",
        pattern:
          /from app\.infrastructure\.persistence\.feature_a\.memory_item_repository import MemoryItemRepository/,
        replacement:
          "from app.infrastructure.persistence.database import create_session_factory\nfrom app.infrastructure.persistence.feature_a.sqlalchemy_item_repository import (\n    SqlAlchemyItemRepository,\n)",
      },
      {
        file: "src/app/bootstrap/container.py",
        pattern:
          / {4}# ORM recipes replace this adapter with a database-backed repository\.\n {4}repository = MemoryItemRepository\(\)/,
        replacement: "    repository = SqlAlchemyItemRepository(create_session_factory())",
      },
    ],
  },
});
