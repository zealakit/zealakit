import { defineGoRecipe } from "./define.js";
import {
  appendMakefileTargets,
  type SqlDialect,
  selectedSqlDialect,
  writeStagedFile,
} from "./shared.js";

const ENGINE: Record<SqlDialect, string> = { postgres: "postgresql", mysql: "mysql" };

const SCHEMA: Record<SqlDialect, string> = {
  postgres: `CREATE TABLE example (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  mysql: `CREATE TABLE example (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
`,
};

const QUERIES: Record<SqlDialect, string> = {
  postgres: `-- name: GetExample :one
SELECT id, name, created_at FROM example WHERE id = $1;

-- name: ListExamples :many
SELECT id, name, created_at FROM example ORDER BY id;

-- name: CreateExample :exec
INSERT INTO example (name) VALUES ($1);
`,
  mysql: `-- name: GetExample :one
SELECT id, name, created_at FROM example WHERE id = ?;

-- name: ListExamples :many
SELECT id, name, created_at FROM example ORDER BY id;

-- name: CreateExample :exec
INSERT INTO example (name) VALUES (?);
`,
};

export default defineGoRecipe({
  id: "sqlc",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api", "background-worker"],
    databases: ["postgresql", "mysql"],
  },
  name: "sqlc",
  hint: "Type-safe queries generated from SQL (needs postgres or mysql)",
  category: "orm",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  requiresAnyOf: ["postgres", "mysql"],
  finalize(targetDir, { config }) {
    const dialect = selectedSqlDialect(config.recipeIds);
    writeStagedFile(
      targetDir,
      "sqlc.yaml",
      `version: "2"
sql:
  - engine: "${ENGINE[dialect]}"
    queries: "db/queries"
    schema: "db/schema"
    gen:
      go:
        package: "sqlc"
        out: "internal/infrastructure/persistence/sqlc"
        sql_package: "database/sql"
`,
    );
    writeStagedFile(targetDir, "db/schema/schema.sql", SCHEMA[dialect]);
    writeStagedFile(targetDir, "db/queries/example.sql", QUERIES[dialect]);
    appendMakefileTargets(
      targetDir,
      "sqlc:",
      `.PHONY: sqlc sqlc-vet

sqlc:
	sqlc generate

sqlc-vet:
	sqlc vet`,
    );
  },
});
