import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scaffold } from "../helpers/scaffold.js";

const templateIds = ["stdlib-api", "gin-api", "stdlib-worker"] as const;

const recipes = [
  {
    id: "mysql",
    source: "internal/infrastructure/database/mysql.go",
    test: "internal/infrastructure/database/mysql_test.go",
    module: "github.com/go-sql-driver/mysql",
    version: "v1.9.3",
    env: [/DATABASE_URL=/, /DB_MAX_OPEN_CONNS=/],
    agent: ".agents/skills/mysql/SKILL.md",
  },
  {
    id: "mongodb",
    source: "internal/infrastructure/database/mongodb.go",
    test: "internal/infrastructure/database/mongodb_test.go",
    module: "go.mongodb.org/mongo-driver/v2",
    version: "v2.8.2",
    env: [/MONGODB_URI=/, /MONGODB_DATABASE=/, /MONGODB_OPERATION_TIMEOUT=/],
    agent: ".agents/skills/mongodb/SKILL.md",
  },
] as const;

describe("Go database recipes", () => {
  for (const recipe of recipes) {
    for (const templateId of templateIds) {
      it(`adds ${recipe.id} to ${templateId}`, async () => {
        const app = await scaffold(templateId, [recipe.id]);

        for (const file of [
          recipe.source,
          recipe.test,
          `.agents/rules/${recipe.id}.mdc`,
          recipe.agent,
        ]) {
          assert.ok(app.exists(file), `${file} should exist`);
        }
        assert.ok(!app.exists("package.json"));

        const goMod = app.read("go.mod");
        assert.equal(
          goMod.match(new RegExp(recipe.module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))
            ?.length,
          1,
        );
        assert.match(
          goMod,
          new RegExp(
            `require ${recipe.module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${recipe.version}`,
          ),
        );

        const env = app.read(".env.example");
        for (const pattern of recipe.env) assert.match(env, pattern);
        const agents = app.read("AGENTS.md");
        assert.equal(
          agents.match(new RegExp(recipe.agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))
            ?.length,
          1,
        );

        const leaked = ["overlays", "shared", "scaffold"].filter((entry) => app.exists(entry));
        assert.deepEqual(leaked, []);
      });
    }
  }
});
