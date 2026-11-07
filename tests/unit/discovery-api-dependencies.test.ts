import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiResponse,
  type DiscoveryValidationData,
  handleDiscoveryRequest,
  registerRecipe,
} from "@zealakit/core";

/** Synthetic recipes registered in this file only (Node runs test files in separate processes). */
function synthetic(id: string, dependsOn: string[]) {
  return {
    id,
    name: `Synthetic ${id}`,
    category: "utils" as const,
    supportedScopes: "all" as const,
    dependsOn,
    packages: {},
    devDependencies: {},
    scripts: {},
  };
}

registerRecipe(synthetic("api-missing-dependency", ["not-registered"]));
registerRecipe(synthetic("api-with-dependency", ["biome"]));
registerRecipe(synthetic("api-cycle-a", ["api-cycle-b"]));
registerRecipe(synthetic("api-cycle-b", ["api-cycle-a"]));

async function validate(recipeIds: string[]): Promise<DiscoveryApiResponse> {
  return await handleDiscoveryRequest({
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    operation: "validate",
    selection: { templateId: "vite-react", recipeIds },
  });
}

function data(response: DiscoveryApiResponse): DiscoveryValidationData {
  assert.equal(response.ok, true);
  assert.equal(response.operation, "validate");
  return (response as Extract<DiscoveryApiResponse, { operation: "validate" }>).data;
}

describe("Discovery API — recipe dependency validation", () => {
  it("reports a missing transitive dependency without scaffolding", async () => {
    const result = data(await validate(["api-missing-dependency"]));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "MISSING_DEPENDENCY"));
  });

  it("reports dependency cycles", async () => {
    const result = data(await validate(["api-cycle-a"]));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "DEPENDENCY_CYCLE"));
  });

  it("resolves valid dependencies and reports auto-injected recipes", async () => {
    const result = data(await validate(["api-with-dependency"]));
    assert.equal(result.valid, true);
    assert.ok(result.resolvedRecipeIds.includes("biome"));
    assert.ok(result.warnings.some((warning) => warning.includes("Auto-injected")));
  });
});
