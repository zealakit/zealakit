import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRecipe,
  getRecipeIncompatibility,
  getTemplate,
  suggestAlternatives,
  validateRecipeConflicts,
  validateRecipeIds,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core";
import { isValidNpmPackageName } from "@zealakit/ecosystem-node";

function incompatibility(recipeId: string, templateId: string): string | undefined {
  const recipe = getRecipe(recipeId);
  const template = getTemplate(templateId);
  assert.ok(recipe && template);
  return getRecipeIncompatibility(recipe, template);
}

describe("project name", () => {
  it("follows npm naming rules", () => {
    for (const name of ["my-app", "@scope/app", "app.v2"]) {
      assert.ok(isValidNpmPackageName(name), name);
    }
    for (const name of ["", "My-App", ".app", "_app", "my app", "node_modules"]) {
      assert.ok(!isValidNpmPackageName(name), name);
    }
  });
});

describe("recipe conflicts", () => {
  it("allows one exclusive recipe per category", () => {
    assert.ok(validateRecipeConflicts(["biome", "zustand", "kyjs", "mui"]).valid);
  });

  it("lets non-exclusive recipes sit beside an exclusive kit", () => {
    assert.ok(validateRecipeConflicts(["mui", "storybook"]).valid);
  });

  it("rejects two exclusive recipes in the same category", () => {
    const { errors } = validateRecipeConflicts(["biome", "eslint"]);
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /Recipe conflict detected/);
    assert.match(errors[0] ?? "", /exclusive 'linter'/);
    assert.match(errors[0] ?? "", /biome/);
    assert.match(errors[0] ?? "", /eslint/);
  });

  it("ignores duplicated ids", () => {
    assert.ok(validateRecipeConflicts(["biome", "biome"]).valid);
  });

  it("reports unknown recipes", () => {
    const { errors } = validateRecipeIds(["nope"]);
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /Unknown recipe/);
    assert.match(errors[0] ?? "", /nope/);
  });
});

describe("compatibility", () => {
  it("checks scope strictly (hybrid does not accept server-only recipes)", () => {
    // ORMs now support hybrid; a server-only recipe would still fail here.
    assert.equal(incompatibility("type-orm", "next"), undefined);
    assert.equal(incompatibility("type-orm", "nest"), undefined);
    assert.match(incompatibility("type-orm", "vite-react") ?? "", /scope 'client'/);
  });

  it("checks the template UI framework", () => {
    assert.match(
      incompatibility("zustand", "nuxt") ?? "",
      /targets react; template 'nuxt' uses vue/,
    );
    assert.equal(incompatibility("nanostores", "nuxt"), undefined);
    assert.equal(incompatibility("zustand", "next"), undefined);
  });

  it("suggests compatible alternatives in the same category", () => {
    const vue = getTemplate("vite-vue");
    assert.ok(vue);
    assert.deepEqual(suggestAlternatives("zustand", vue), ["pinia", "nanostores"]);
  });

  it("validates a full config in one pass", () => {
    const result = validateScaffoldConfig({
      projectName: "Bad Name",
      templateId: "vite-vue",
      recipeIds: ["antd", "biome", "eslint"],
    });
    assert.equal(result.errors.length, 3);
  });
});

describe("default recipes", () => {
  it("prepends defaults for client/hybrid scopes and dedupes", () => {
    assert.deepEqual(withDefaultRecipes("client", ["biome", "client-shared-pieces"]), [
      "client-shared-pieces",
      "biome",
    ]);
    assert.deepEqual(withDefaultRecipes("server", ["biome"]), ["biome"]);
  });
});
