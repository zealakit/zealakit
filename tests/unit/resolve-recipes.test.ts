import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRecipeResolveError, resolveRecipeDependencies } from "../../src/resolve-recipes.js";
import type { RecipeConfig } from "../../src/types.js";

function recipe(partial: Partial<RecipeConfig> & Pick<RecipeConfig, "id">): RecipeConfig {
  return {
    name: partial.id,
    category: "utils",
    supportedScopes: "all",
    packages: {},
    devDependencies: {},
    scripts: {},
    ...partial,
  };
}

describe("resolveRecipeDependencies", () => {
  const registry = {
    a: recipe({ id: "a", dependsOn: ["b"] }),
    b: recipe({ id: "b", dependsOn: ["c"] }),
    c: recipe({ id: "c" }),
    d: recipe({ id: "d", dependsOn: ["missing"] }),
    e: recipe({ id: "e", dependsOn: ["f"] }),
    f: recipe({ id: "f", dependsOn: ["e"] }),
    x: recipe({ id: "x" }),
    y: recipe({ id: "y" }),
  };
  const lookup = (id: string) => registry[id as keyof typeof registry];
  const order = Object.keys(registry);

  it("resolves transitive dependencies in deterministic order", () => {
    const result = resolveRecipeDependencies(["a"], lookup, order);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.recipeIds, ["c", "b", "a"]);
    assert.deepEqual(result.autoInjected, ["c", "b"]);
    assert.deepEqual(result.selectedIds, ["a"]);
  });

  it("dedupes selected ids and already-listed deps", () => {
    const result = resolveRecipeDependencies(["a", "b", "a"], lookup, order);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.recipeIds, ["c", "b", "a"]);
    assert.deepEqual(result.autoInjected, ["c"]);
  });

  it("preserves selection order when there are no edges", () => {
    const result = resolveRecipeDependencies(["y", "x"], lookup, order);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.recipeIds, ["y", "x"]);
  });

  it("detects missing dependencies", () => {
    const result = resolveRecipeDependencies(["d"], lookup, order);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "missing");
    assert.match(formatRecipeResolveError(result.error), /missing/);
  });

  it("detects circular dependencies", () => {
    const result = resolveRecipeDependencies(["e"], lookup, order);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "cycle");
    assert.match(formatRecipeResolveError(result.error), /Circular/);
  });
});
