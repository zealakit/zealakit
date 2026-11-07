import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkRecipeCompatibility,
  getInfo,
  getRecipe,
  getRecipeProfile,
  getTemplate,
  isRecipeCompatible,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  validateScaffoldConfig,
} from "@zealakit/core";

const templateIds = ["stdlib-api", "gin-api", "stdlib-worker"];

const goRecipes = [
  {
    id: "postgres",
    name: "PostgreSQL",
    profile: {
      id: "postgres",
      capabilities: ["database"],
      projectTypes: ["server-api", "background-worker"],
      databases: ["postgresql"],
    },
    goModules: { "github.com/jackc/pgx/v5": "v5.7.4" },
  },
  {
    id: "mysql",
    name: "MySQL",
    profile: {
      id: "mysql",
      capabilities: [],
      projectTypes: ["server-api", "background-worker"],
      databases: ["mysql"],
    },
    goModules: { "github.com/go-sql-driver/mysql": "v1.9.3" },
  },
  {
    id: "mongodb",
    name: "MongoDB",
    profile: {
      id: "mongodb",
      capabilities: [],
      projectTypes: ["server-api", "background-worker"],
    },
    goModules: { "go.mongodb.org/mongo-driver/v2": "v2.8.2" },
  },
] as const;

describe("Go recipe registration", () => {
  it("registers all Go recipes in registration order", () => {
    const goIds = getInfo()
      .data.recipes.filter((recipe) => recipe.ecosystem === "go")
      .map((recipe) => recipe.id);
    assert.deepEqual(goIds, ["postgres", "mysql", "mongodb"]);
  });

  for (const expected of goRecipes) {
    it(`registers ${expected.id} with Go metadata`, () => {
      const recipe = getRecipe(expected.id);
      assert.ok(recipe);
      assert.equal(recipe.name, expected.name);
      assert.equal(recipe.ecosystem, "go");
      assert.equal(recipe.path, `go/${expected.id}`);
      assert.deepEqual(recipe.supportedScopes, ["server", "infrastructure"]);
      assert.equal(recipe.category, "infrastructure");
      assert.equal(recipe.exclusive, true);
      assert.deepEqual(getRecipeProfile(expected.id), expected.profile);
    });

    it(`exposes ${expected.id} through Info metadata`, () => {
      const info = getInfo({ recipeId: expected.id });
      assert.deepEqual(
        info.data.recipes.map((recipe) => recipe.id),
        [expected.id],
      );
      const metadata = info.data.recipes[0];
      assert.ok(metadata);
      assert.equal(metadata.ecosystem, "go");
      assert.deepEqual(metadata.templates, templateIds);
      assert.deepEqual(metadata.incompatibleTemplates, []);
      assert.deepEqual(metadata.goModules, expected.goModules);
      assert.ok(metadata.transformedFiles["go.mod"] === undefined);
      assert.ok(metadata.hasAgentEntry);
    });
  }

  it("keeps database recipes mutually exclusive", () => {
    const validation = validateScaffoldConfig({
      projectName: "database-conflict",
      templateId: "stdlib-api",
      recipeIds: ["postgres", "mysql"],
    });
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join("\n"), /exclusive|conflict/i);

    const mongoConflict = validateScaffoldConfig({
      projectName: "database-conflict-mongo",
      templateId: "stdlib-api",
      recipeIds: ["postgres", "mongodb"],
    });
    assert.equal(mongoConflict.valid, false);
    assert.match(mongoConflict.errors.join("\n"), /exclusive|conflict/i);
  });
});

describe("Go recipe compatibility", () => {
  for (const expected of goRecipes) {
    it(`${expected.id} supports every Go template and rejects Node templates`, () => {
      const recipe = getRecipe(expected.id);
      assert.ok(recipe);
      for (const templateId of templateIds) {
        const template = getTemplate(templateId);
        assert.ok(template);
        assert.ok(isRecipeCompatible(recipe, template), templateId);
      }
      for (const templateId of ["nest", "hono", "vite-react", "next"]) {
        const template = getTemplate(templateId);
        assert.ok(template);
        assert.equal(isRecipeCompatible(recipe, template), false);
        assert.equal(checkRecipeCompatibility(recipe, template)?.code, "ecosystem");
      }
    });
  }

  it("is recommended by Discovery for a Go API with PostgreSQL", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "server-api",
      apiStorageNeed: "relational",
      backendRuntime: "go",
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    const result = matchDiscovery(normalized.requirements);
    assert.ok(result.recommendedRecipeIds.includes("postgres"));
    const match = result.recipes.find((entry) => entry.recipeId === "postgres");
    assert.ok(match);
    assert.equal(match.compatible, true);
    assert.equal(match.relevant, true);
  });
});
