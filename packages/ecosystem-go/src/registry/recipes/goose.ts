import path from "node:path";
import { getRecipeDir } from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";
import {
  addGoRequires,
  appendMakefileTargets,
  mergeGoSum,
  type SqlDialect,
  selectedSqlDialect,
  writeStagedFile,
} from "./shared.js";

const GO_MODULES = {
  "github.com/pressly/goose/v3": "v3.22.1",
} as const;

const MIGRATE_GO = (dialect: SqlDialect): string => `package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// migrationDialect is chosen by the database recipe (postgres or mysql).
const migrationDialect = "${dialect}"

// Migrate runs a goose command ("up", "down" or "status") against db using the
// embedded SQL files in migrations/.
func Migrate(ctx context.Context, db *sql.DB, command string) error {
	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect(migrationDialect); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	switch command {
	case "up":
		return goose.UpContext(ctx, db, "migrations")
	case "down":
		return goose.DownContext(ctx, db, "migrations")
	case "status":
		return goose.StatusContext(ctx, db, "migrations")
	default:
		return fmt.Errorf("unknown command %q (use up, down or status)", command)
	}
}
`;

const FIRST_MIGRATION: Record<SqlDialect, string> = {
  postgres: `-- +goose Up
CREATE TABLE IF NOT EXISTS example (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS example;
`,
  mysql: `-- +goose Up
CREATE TABLE IF NOT EXISTS example (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

-- +goose Down
DROP TABLE IF EXISTS example;
`,
};

export default defineGoRecipe({
  id: "goose",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api", "background-worker"],
    databases: ["postgresql", "mysql"],
  },
  name: "goose migrations",
  hint: "Embedded SQL migrations + cmd/migrate (needs postgres or mysql)",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: false,
  requiresAnyOf: ["postgres", "mysql"],
  goModules: { ...GO_MODULES },
  finalize(targetDir, { config }) {
    const dialect = selectedSqlDialect(config.recipeIds);
    addGoRequires(targetDir, GO_MODULES, "goose");
    mergeGoSum(targetDir, path.join(getRecipeDir("goose"), "scaffold", "go.sum"));
    writeStagedFile(targetDir, "internal/infrastructure/database/migrate.go", MIGRATE_GO(dialect));
    writeStagedFile(
      targetDir,
      "internal/infrastructure/database/migrations/00001_create_example_table.sql",
      FIRST_MIGRATION[dialect],
    );
    appendMakefileTargets(
      targetDir,
      "migrate-up",
      `.PHONY: migrate-up migrate-down migrate-status

migrate-up:
	go run ./cmd/migrate up

migrate-down:
	go run ./cmd/migrate down

migrate-status:
	go run ./cmd/migrate status`,
    );
  },
});
