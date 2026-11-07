import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scaffold } from "../helpers/scaffold.js";

const templateIds = ["stdlib-api", "gin-api", "stdlib-worker"] as const;

describe("Go postgres recipe", () => {
  for (const templateId of templateIds) {
    it(`adds PostgreSQL to ${templateId}`, async () => {
      const app = await scaffold(templateId, ["postgres"]);

      for (const file of [
        "internal/infrastructure/database/postgres.go",
        "internal/infrastructure/database/postgres_test.go",
        ".agents/rules/postgres.mdc",
        ".agents/skills/postgres/SKILL.md",
      ]) {
        assert.ok(app.exists(file), `${file} should exist`);
      }
      assert.ok(!app.exists("package.json"));

      const goMod = app.read("go.mod");
      assert.equal(goMod.match(/github\.com\/jackc\/pgx\/v5/g)?.length, 1);
      assert.match(goMod, /require github\.com\/jackc\/pgx\/v5 v5\.7\.4/);
      assert.match(app.read("go.sum"), /github\.com\/jackc\/pgx\/v5 v5\.7\.4/);

      assert.match(app.read(".env.example"), /DATABASE_URL=/);
      assert.match(app.read(".env.example"), /DB_MAX_OPEN_CONNS=/);
      const agents = app.read("AGENTS.md");
      assert.equal(agents.match(/\.agents\/skills\/postgres\/SKILL\.md/g)?.length, 1);

      const leaked = ["overlays", "shared", "scaffold"].filter((entry) => app.exists(entry));
      assert.deepEqual(leaked, []);
    });
  }
});
