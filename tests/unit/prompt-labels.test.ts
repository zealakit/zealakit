import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultRecipeIdsForScope,
  formatSelectionSummary,
  recipeOptionHint,
  templateOptionHint,
  templateOptionLabel,
} from "../../src/prompt-labels.js";
import { getRecipe, getTemplate } from "../../src/registry/index.js";

describe("prompt labels", () => {
  it("shows scope, framework, and default on templates", () => {
    const viteReact = getTemplate("vite-react");
    const nest = getTemplate("nest");
    assert.ok(viteReact && nest);
    assert.equal(templateOptionLabel(viteReact), "Vite + React + TypeScript");
    assert.equal(templateOptionHint(viteReact), "client · react · default");
    assert.equal(templateOptionHint(nest), "server");
  });

  it("includes recipe hints and dependsOn", () => {
    const biome = getRecipe("biome");
    assert.ok(biome);
    assert.match(recipeOptionHint(biome), /recommended/i);

    const withDeps = { ...biome, dependsOn: ["eslint"] };
    assert.match(recipeOptionHint(withDeps), /needs eslint/);
  });

  it("lists default recipes per scope", () => {
    assert.deepEqual(defaultRecipeIdsForScope("client"), ["client-shared-pieces"]);
    assert.deepEqual(defaultRecipeIdsForScope("server"), []);
  });

  it("separates selected and auto-injected recipes in the summary", () => {
    const template = getTemplate("next");
    assert.ok(template);
    const summary = formatSelectionSummary({
      projectName: "app",
      template,
      selectedIds: ["biome", "mui"],
      autoInjectedIds: ["client-shared-pieces"],
    });
    assert.match(summary, /Template:\s+next \(hybrid, react\)/);
    assert.match(summary, /Selected:\s+biome, mui/);
    assert.match(summary, /Auto:\s+client-shared-pieces/);
  });
});
