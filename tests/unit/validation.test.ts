import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRecipeIncompatibility, suggestAlternatives } from "../../src/compat.js";
import { getRecipe, getTemplate, withDefaultRecipes } from "../../src/registry/index.js";
import {
  isValidNpmPackageName,
  validateRecipeConflicts,
  validateRecipeIds,
  validateScaffoldConfig,
} from "../../src/validation/index.js";

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
    assert.deepEqual(errors, [
      "✖ Conflict: Cannot select both 'biome' and 'eslint' in the linter group. Please choose only one.",
    ]);
  });

  it("ignores duplicated ids", () => {
    assert.ok(validateRecipeConflicts(["biome", "biome"]).valid);
  });

  it("reports unknown recipes", () => {
    assert.deepEqual(validateRecipeIds(["nope"]).errors, ["Invalid recipe(s): 'nope'."]);
  });
});

describe("compatibility", () => {
  it("checks scope strictly (hybrid does not accept server-only recipes)", () => {
    assert.match(incompatibility("type-orm", "next") ?? "", /scope 'hybrid'/);
    assert.equal(incompatibility("type-orm", "nest"), undefined);
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
