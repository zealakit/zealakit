import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInfo,
  getRecipe,
  getTemplate,
  getTemplateProfile,
  isRecipeCompatible,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  queryMetadata,
  resolveTemplateProfile,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core";

const template = getTemplate("vite-svelte");
const profile = getTemplateProfile("vite-svelte");

describe("vite-svelte registration and metadata", () => {
  it("is registered as a Node client template with the Svelte framework", () => {
    assert.ok(template);
    assert.equal(template.name, "Vite + Svelte");
    assert.equal(template.scope, "client");
    assert.equal(template.uiFramework, "svelte");
    assert.equal(template.ecosystem, undefined);
    assert.equal(template.path, "node/vite-svelte");
  });

  it("has a Discovery profile with SPA / Vite / web-ui metadata", () => {
    assert.ok(profile);
    assert.deepEqual(profile.projectTypes, ["ui"]);
    assert.deepEqual(profile.frontendModes, ["spa"]);
    assert.equal(profile.delivery, "vite");
    assert.deepEqual(profile.capabilities, ["web-ui"]);
    assert.deepEqual(profile.architectureLevels, ["minimal"]);

    const resolved = resolveTemplateProfile("vite-svelte");
    assert.ok(resolved);
    assert.equal(resolved.scope, "client");
    assert.equal(resolved.uiFramework, "svelte");
    assert.equal(resolved.ecosystem, "node");
    assert.deepEqual(resolved.frontend, { frameworks: ["svelte"], modes: ["spa"] });
  });

  it("is visible through metadata queries and filters", () => {
    const info = getInfo({ templateId: "vite-svelte", discovery: true });
    assert.equal(info.schemaVersion, 4);
    assert.deepEqual(
      info.data.templates.map((entry) => entry.id),
      ["vite-svelte"],
    );
    assert.ok(info.data.templates[0]?.discovery, "discovery profile is attached");

    const byFramework = queryMetadata({ uiFramework: "svelte" });
    assert.equal(byFramework.ok, true);
    if (byFramework.ok) {
      assert.deepEqual(
        byFramework.data.templates.map((entry) => entry.id),
        ["vite-svelte"],
      );
    }

    const jsonInfo = getInfo({ discovery: true, uiFramework: "svelte" });
    assert.deepEqual(
      jsonInfo.data.templates.map((entry) => entry.id),
      ["vite-svelte"],
    );
  });

  it("is recommended by Discovery for an explicit Svelte UI preference", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "ui",
      uiTechPreference: "svelte",
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    const result = matchDiscovery(normalized.requirements);
    assert.equal(result.recommendedTemplateId, "vite-svelte");
    assert.deepEqual(
      result.templates.filter((entry) => entry.compatible).map((entry) => entry.templateId),
      ["vite-svelte"],
    );
  });

  it("accepts framework-agnostic recipes and rejects React/Vue-only recipes", () => {
    assert.ok(template);
    for (const recipeId of ["biome", "eslint", "storybook", "nanostores", "kyjs", "axios"]) {
      const recipe = getRecipe(recipeId);
      assert.ok(recipe, `${recipeId} should be registered`);
      assert.ok(isRecipeCompatible(recipe, template), `${recipeId} should support vite-svelte`);
    }

    for (const recipeId of ["mui", "antd", "shadcn-ui", "zustand", "pinia", "nuxt-ui"]) {
      const recipe = getRecipe(recipeId);
      assert.ok(recipe, `${recipeId} should be registered`);
      assert.ok(
        !isRecipeCompatible(recipe, template),
        `${recipeId} must not be offered to vite-svelte`,
      );
    }
  });

  it("validates with the default client recipes", () => {
    assert.ok(template);
    const recipeIds = withDefaultRecipes(template.scope, []);
    assert.deepEqual(recipeIds, ["client-shared-pieces"]);
    const validation = validateScaffoldConfig({
      projectName: "svelte-app",
      templateId: "vite-svelte",
      recipeIds,
    });
    assert.deepEqual(validation, { valid: true, errors: [] });
  });
});
