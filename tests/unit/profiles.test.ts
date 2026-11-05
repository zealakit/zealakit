import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAllRecipeIds,
  getAllRecipeProfiles,
  getAllTemplateIds,
  getAllTemplateProfiles,
  getConflictingRecipes,
  getRecipe,
  getRecipeProfile,
  getTemplate,
  getTemplateProfile,
  type RecipeConfig,
  type RecipeProfile,
  resolveRecipeProfile,
  resolveTemplateProfile,
  type TemplateProfile,
  validateProfiles,
} from "@zealakit/core";

describe("template profile registry", () => {
  it("exposes one profile per registered template", () => {
    const templateIds = getAllTemplateIds().sort();
    const profileIds = getAllTemplateProfiles()
      .map((profile) => profile.id)
      .sort();
    assert.deepEqual(profileIds, templateIds);
  });

  it("resolves frontend frameworks from TemplateConfig", () => {
    const resolved = resolveTemplateProfile("vite-react");
    assert.ok(resolved);
    assert.equal(resolved.scope, "client");
    assert.equal(resolved.uiFramework, "react");
    assert.deepEqual(resolved.frontend?.frameworks, ["react"]);
    assert.deepEqual(resolved.frontend?.modes, ["spa"]);
    assert.ok(resolved.capabilities.includes("web-ui"));
    assert.equal(resolved.backend, undefined);
  });

  it("resolves server templates without frontend metadata", () => {
    const resolved = resolveTemplateProfile("nest");
    assert.ok(resolved);
    assert.equal(resolved.frontend, undefined);
    assert.deepEqual(resolved.backend?.frameworks, ["nest"]);
    assert.deepEqual(resolved.capabilities, ["http-api"]);
  });

  it("resolves Go worker as background-processing only", () => {
    const resolved = resolveTemplateProfile("stdlib-worker");
    assert.ok(resolved);
    assert.equal(resolved.scope, "infrastructure");
    assert.deepEqual(resolved.capabilities, ["background-processing"]);
    assert.ok(!resolved.capabilities.includes("http-api"));
    assert.ok(!resolved.capabilities.includes("web-ui"));
  });

  it("returns undefined for unknown template ids", () => {
    assert.equal(getTemplateProfile("no-such-template"), undefined);
    assert.equal(resolveTemplateProfile("no-such-template"), undefined);
  });
});

describe("recipe profile registry", () => {
  it("exposes one profile per registered recipe", () => {
    const recipeIds = getAllRecipeIds().sort();
    const profileIds = getAllRecipeProfiles()
      .map((profile) => profile.id)
      .sort();
    assert.deepEqual(profileIds, recipeIds);
  });

  it("derives exclusivity conflicts from RecipeConfig, not authored profile data", () => {
    const resolved = resolveRecipeProfile("biome");
    assert.ok(resolved);
    assert.deepEqual(resolved.capabilities, []);
    assert.deepEqual(resolved.categories, ["linter"]);
    assert.deepEqual(resolved.conflicts.sort(), ["eslint"]);
    assert.deepEqual(resolved.dependsOn, []);
  });

  it("marks ORM recipes as database providers", () => {
    const resolved = resolveRecipeProfile("prisma");
    assert.ok(resolved);
    assert.deepEqual(resolved.capabilities, ["database"]);
    assert.deepEqual(resolved.databases, ["postgresql", "mysql", "sqlite"]);
    assert.ok(resolved.conflicts.includes("drizzle-orm"));
  });

  it("marks fetchers as external-api capabilities", () => {
    assert.deepEqual(getRecipeProfile("kyjs")?.capabilities, ["external-api"]);
    assert.deepEqual(getRecipeProfile("axios")?.capabilities, ["external-api"]);
  });

  it("returns undefined for unknown recipe ids", () => {
    assert.equal(getRecipeProfile("no-such-recipe"), undefined);
    assert.equal(resolveRecipeProfile("no-such-recipe"), undefined);
  });
});

describe("validateProfiles", () => {
  it("passes for the live registry and builtin profiles", () => {
    const check = validateProfiles();
    assert.equal(check.valid, true, check.errors.join("\n"));
  });

  it("flags duplicate profile ids", () => {
    const profiles: TemplateProfile[] = [
      { id: "vite-react", projectTypes: ["web-app"], capabilities: ["web-ui"] },
      { id: "vite-react", projectTypes: ["website"], capabilities: ["web-ui"] },
    ];
    const check = validateProfiles({
      templateIds: ["vite-react"],
      recipeIds: [],
      templateProfiles: profiles,
      recipeProfiles: [],
    });
    assert.equal(check.valid, false);
    assert.ok(check.errors.some((error) => error.includes("Duplicate template profile")));
  });

  it("flags profiles for unknown template/recipe ids", () => {
    const check = validateProfiles({
      templateIds: ["vite-react"],
      recipeIds: ["biome"],
      templateProfiles: [
        { id: "ghost-template", projectTypes: ["api"], capabilities: ["http-api"] },
      ],
      recipeProfiles: [{ id: "ghost-recipe", capabilities: [] }],
    });
    assert.equal(check.valid, false);
    assert.ok(check.errors.some((error) => error.includes("ghost-template")));
    assert.ok(check.errors.some((error) => error.includes("ghost-recipe")));
    assert.ok(check.errors.some((error) => error.includes("missing a profile")));
  });

  it("flags invalid constant values", () => {
    const badTemplate = {
      id: "vite-react",
      projectTypes: ["not-a-type"],
      capabilities: ["web-ui"],
      frontendModes: ["not-a-mode"],
    } as unknown as TemplateProfile;
    const badRecipe = {
      id: "biome",
      capabilities: ["not-a-cap"],
    } as unknown as RecipeProfile;

    const check = validateProfiles({
      templateIds: ["vite-react"],
      recipeIds: ["biome"],
      templateProfiles: [badTemplate],
      recipeProfiles: [badRecipe],
    });
    assert.equal(check.valid, false);
    assert.ok(check.errors.some((error) => error.includes("not-a-type")));
    assert.ok(check.errors.some((error) => error.includes("not-a-mode")));
    assert.ok(check.errors.some((error) => error.includes("not-a-cap")));
  });

  it("flags self-dependencies and unknown dependsOn", () => {
    const biome = getRecipe("biome");
    assert.ok(biome);
    const selfDep: RecipeConfig = { ...biome, dependsOn: ["biome"] };
    const unknownDep: RecipeConfig = { ...biome, dependsOn: ["missing-dep"] };

    const selfCheck = validateProfiles({
      templateIds: getAllTemplateIds(),
      recipeIds: getAllRecipeIds(),
      getRecipeById: (id) => (id === "biome" ? selfDep : getRecipe(id)),
    });
    assert.equal(selfCheck.valid, false);
    assert.ok(selfCheck.errors.some((error) => error.includes("cannot depend on itself")));

    const unknownCheck = validateProfiles({
      templateIds: getAllTemplateIds(),
      recipeIds: getAllRecipeIds(),
      getRecipeById: (id) => (id === "biome" ? unknownDep : getRecipe(id)),
    });
    assert.equal(unknownCheck.valid, false);
    assert.ok(unknownCheck.errors.some((error) => error.includes("missing-dep")));
  });

  it("flags self-conflicts and unknown conflict targets", () => {
    const biome = getRecipe("biome");
    assert.ok(biome);

    const selfCheck = validateProfiles({
      templateIds: getAllTemplateIds(),
      recipeIds: getAllRecipeIds(),
      getConflicts: (recipe) => (recipe.id === "biome" ? ["biome"] : getConflictingRecipes(recipe)),
    });
    assert.equal(selfCheck.valid, false);
    assert.ok(selfCheck.errors.some((error) => error.includes("cannot conflict with itself")));

    const unknownCheck = validateProfiles({
      templateIds: getAllTemplateIds(),
      recipeIds: getAllRecipeIds(),
      getConflicts: (recipe) =>
        recipe.id === "biome" ? ["missing-conflict"] : getConflictingRecipes(recipe),
    });
    assert.equal(unknownCheck.valid, false);
    assert.ok(unknownCheck.errors.some((error) => error.includes("missing-conflict")));
  });

  it("keeps resolved profiles aligned with TemplateConfig / RecipeConfig", () => {
    for (const template of getAllTemplateIds().map(getTemplate)) {
      assert.ok(template);
      const resolved = resolveTemplateProfile(template.id);
      assert.ok(resolved);
      assert.equal(resolved.scope, template.scope);
      assert.equal(resolved.uiFramework, template.uiFramework);
      assert.equal(resolved.ecosystem, template.ecosystem ?? "node");
    }

    for (const recipeId of getAllRecipeIds()) {
      const recipe = getRecipe(recipeId);
      assert.ok(recipe);
      const resolved = resolveRecipeProfile(recipeId);
      assert.ok(resolved);
      assert.deepEqual(resolved.dependsOn, recipe.dependsOn ?? []);
      assert.deepEqual(resolved.conflicts.sort(), getConflictingRecipes(recipe).sort());
    }
  });
});
