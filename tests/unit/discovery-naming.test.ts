import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createProjectNaming,
  DISCOVERY_QUESTIONS,
  type ProjectRequirements,
  type ScaffoldConfig,
} from "@zealakit/core";
import { isValidNpmPackageName } from "@zealakit/ecosystem-node";
import { formatDiscoverySummary } from "../../apps/cli/src/discovery/present.js";

describe("discovery naming stage", () => {
  it("starts the questionnaire with project type, not a project name", () => {
    assert.equal(DISCOVERY_QUESTIONS[0]?.id, "projectType");
    assert.ok(!DISCOVERY_QUESTIONS.some((question) => question.id === ("projectName" as never)));
  });

  it("keeps ProjectRequirements free of naming fields", () => {
    const requirements: ProjectRequirements = {
      projectType: "ui",
      scopes: [],
      capabilities: [],
    };
    assert.equal("projectName" in requirements, false);
    assert.equal("naming" in requirements, false);
  });

  it("builds ProjectNaming separately from requirements", () => {
    const naming = createProjectNaming("my-app");
    assert.deepEqual(naming, { projectName: "my-app" });
    assert.equal(naming.workspaceName, undefined);
  });

  it("review summary can omit the project name until the naming stage", () => {
    const withoutName = formatDiscoverySummary({
      templateId: "vite-react",
      recipeIds: [],
    });
    assert.doesNotMatch(withoutName, /^Name:/m);
    assert.match(withoutName, /Template:/);

    const withName = formatDiscoverySummary({
      projectName: "demo",
      templateId: "vite-react",
      recipeIds: [],
    });
    assert.match(withName, /Name:\s+demo/);
  });

  it("includes naming in the final ScaffoldConfig shape", () => {
    const naming = createProjectNaming("shop-api");
    const config: ScaffoldConfig = {
      projectName: naming.projectName,
      templateId: "hono",
      recipeIds: ["biome"],
    };
    assert.equal(config.projectName, "shop-api");
    assert.ok(isValidNpmPackageName(config.projectName));
  });

  it("rejects invalid project names with the existing npm rules", () => {
    assert.equal(isValidNpmPackageName(""), false);
    assert.equal(isValidNpmPackageName("My App"), false);
    assert.equal(isValidNpmPackageName("my-app"), true);
  });
});
