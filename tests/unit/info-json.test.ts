import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INFO_SCHEMA_VERSION } from "@zealakit/core";
import { buildInfoResponse, type InfoResponse } from "../../apps/cli/src/info.js";

function containsFunction(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (Array.isArray(value)) return value.some(containsFunction);
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(containsFunction);
  }
  return false;
}

describe("info JSON structure", () => {
  const response = buildInfoResponse();

  it("includes a schema version and command", () => {
    assert.equal(response.schemaVersion, INFO_SCHEMA_VERSION);
    assert.equal(response.command, "info");
    assert.deepEqual(response.filters, {});
  });

  it("represents ecosystems, templates and recipes with stable ids", () => {
    assert.ok(Array.isArray(response.data.ecosystems));
    assert.ok(response.data.ecosystems.length > 0);
    for (const ecosystem of response.data.ecosystems) {
      assert.equal(typeof ecosystem.id, "string");
      assert.equal(typeof ecosystem.label, "string");
      assert.ok(Array.isArray(ecosystem.templates));
      assert.ok(Array.isArray(ecosystem.recipes));
    }

    assert.ok(response.data.templates.length > 0);
    for (const template of response.data.templates) {
      assert.equal(typeof template.id, "string");
      assert.equal(typeof template.ecosystem, "string");
      assert.equal(typeof template.scope, "string");
      assert.ok(Array.isArray(template.promptSteps));
      assert.ok(Array.isArray(template.compatibleRecipes));
    }

    assert.ok(response.data.recipes.length > 0);
    for (const recipe of response.data.recipes) {
      assert.equal(typeof recipe.id, "string");
      assert.equal(typeof recipe.ecosystem, "string");
      assert.ok(Array.isArray(recipe.categories));
      assert.ok(Array.isArray(recipe.templates));
    }
  });

  it("keeps optional metadata explicit and consistent", () => {
    const parsed = JSON.parse(JSON.stringify(response)) as InfoResponse;
    for (const template of parsed.data.templates) {
      assert.equal("discovery" in template, false);
    }
    for (const recipe of parsed.data.recipes) {
      assert.equal("discovery" in recipe, false);
    }

    const withDiscovery = JSON.parse(
      JSON.stringify(buildInfoResponse({ discover: true })),
    ) as InfoResponse;
    for (const template of withDiscovery.data.templates) {
      assert.equal(typeof template.discovery?.id, "string");
    }
    for (const recipe of withDiscovery.data.recipes) {
      assert.equal(typeof recipe.discovery?.id, "string");
    }
  });

  it("serializes without functions or runtime-only objects", () => {
    assert.equal(containsFunction(response), false);
    const serialized = JSON.stringify(response);
    assert.equal(JSON.stringify(JSON.parse(serialized)), serialized);
    assert.equal(serialized.includes("\u001b["), false);
  });

  it("serializes deterministically", () => {
    assert.equal(JSON.stringify(buildInfoResponse()), JSON.stringify(buildInfoResponse()));
    assert.equal(
      JSON.stringify(buildInfoResponse({ discover: true })),
      JSON.stringify(buildInfoResponse({ discover: true })),
    );
  });
});
