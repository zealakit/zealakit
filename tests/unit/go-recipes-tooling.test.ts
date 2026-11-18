import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  scaffoldProject,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core/internal";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-go-tooling-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
async function generate(template: string, recipes: string[]): Promise<string> {
  return scaffoldProject(
    {
      projectName: `gt-${++counter}`,
      templateId: template,
      recipeIds: withDefaultRecipes("server", recipes),
    },
    workRoot,
  );
}
const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), "utf-8");

describe("requiresAnyOf", () => {
  it("rejects goose and sqlc without a SQL database recipe", () => {
    for (const id of ["goose", "sqlc"]) {
      const result = validateScaffoldConfig({
        projectName: "x",
        templateId: "stdlib-api",
        recipeIds: withDefaultRecipes("server", [id]),
      });
      assert.equal(result.valid, false);
      assert.match(result.errors.join("\n"), /requires one of: postgres, mysql/);
    }
    const mongo = validateScaffoldConfig({
      projectName: "x",
      templateId: "stdlib-api",
      recipeIds: withDefaultRecipes("server", ["mongodb", "goose"]),
    });
    assert.equal(mongo.valid, false);
  });
});

describe("goose", () => {
  it("generates dialect-specific migrations and the migrate command", async () => {
    const pg = await generate("gin-api", ["postgres", "goose"]);
    assert.match(
      read(pg, "internal/infrastructure/database/migrate.go"),
      /migrationDialect = "postgres"/,
    );
    assert.match(
      read(pg, "internal/infrastructure/database/migrations/00001_create_example_table.sql"),
      /BIGSERIAL/,
    );
    assert.match(read(pg, "go.mod"), /github\.com\/pressly\/goose\/v3 v3\.22\.1/);
    assert.match(read(pg, "Makefile"), /migrate-up:\n\tgo run \.\/cmd\/migrate up/);
    // The command imports the project's own module path (rewritten at scaffold time).
    assert.match(
      read(pg, "cmd/migrate/main.go"),
      /"example\.com\/gt-\d+\/internal\/infrastructure\/database"/,
    );

    const my = await generate("stdlib-api", ["mysql", "goose"]);
    assert.match(
      read(my, "internal/infrastructure/database/migrate.go"),
      /migrationDialect = "mysql"/,
    );
    assert.match(
      read(my, "internal/infrastructure/database/migrations/00001_create_example_table.sql"),
      /AUTO_INCREMENT/,
    );
  });
});

describe("sqlc", () => {
  it("writes sqlc.yaml, schema and queries for the selected engine", async () => {
    const pg = await generate("stdlib-api", ["postgres", "sqlc"]);
    assert.match(read(pg, "sqlc.yaml"), /engine: "postgresql"/);
    assert.match(read(pg, "db/queries/example.sql"), /WHERE id = \$1/);
    assert.match(read(pg, "Makefile"), /sqlc generate/);

    const my = await generate("gin-api", ["mysql", "sqlc"]);
    assert.match(read(my, "sqlc.yaml"), /engine: "mysql"/);
    assert.match(read(my, "db/queries/example.sql"), /WHERE id = \?/);
  });

  it("is exclusive in the orm category", () => {
    const result = validateScaffoldConfig({
      projectName: "x",
      templateId: "stdlib-api",
      recipeIds: withDefaultRecipes("server", ["postgres", "sqlc", "sqlc"]),
    });
    assert.equal(result.valid, true, result.errors.join("\n"));
  });
});

describe("redis", () => {
  it("adds the cache package, go.mod requirement and env section", async () => {
    const dir = await generate("stdlib-worker", ["redis"]);
    assert.ok(fs.existsSync(path.join(dir, "internal/infrastructure/cache/redis.go")));
    assert.match(read(dir, "go.mod"), /github\.com\/redis\/go-redis\/v9 v9\.14\.0/);
    assert.match(read(dir, ".env.example"), /REDIS_URL=redis:\/\/localhost:6379\/0/);
  });

  it("coexists with a database recipe", () => {
    const result = validateScaffoldConfig({
      projectName: "x",
      templateId: "gin-api",
      recipeIds: withDefaultRecipes("server", ["postgres", "redis", "goose"]),
    });
    assert.equal(result.valid, true, result.errors.join("\n"));
  });
});
