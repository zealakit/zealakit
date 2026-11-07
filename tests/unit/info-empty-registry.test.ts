import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearRegistry, getInfo, getRecipeMetadata, getTemplateMetadata } from "@zealakit/core";

describe("info metadata with an empty registry", () => {
  it("returns empty collections instead of throwing", () => {
    clearRegistry();

    const info = getInfo();
    assert.deepEqual(info.data.templates, []);
    assert.deepEqual(info.data.recipes, []);
    assert.deepEqual(getTemplateMetadata(), []);
    assert.deepEqual(getRecipeMetadata(), []);
    assert.ok(info.data.ecosystems.length > 0);
    assert.ok(
      info.data.ecosystems.every(
        (ecosystem) => ecosystem.templates.length === 0 && ecosystem.recipes.length === 0,
      ),
    );
    assert.ok(info.data.categories.every((category) => category.recipes.length === 0));
    assert.ok(info.data.rules.every((rule) => (rule.recipes?.length ?? 0) === 0));
  });

  it("is still valid, deterministic JSON", () => {
    const first = getInfo();
    const second = getInfo();
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    const parsed = JSON.parse(JSON.stringify(first)) as typeof first;
    assert.equal(parsed.command, "info");
    assert.deepEqual(parsed.data.templates, []);
  });
});
