import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as publicApi from "@zealakit/core";
import {
  createZealakit,
  type EcosystemRegistration,
  ScaffoldCommitError,
  ScaffoldValidationError,
  type Zealakit,
  ZealakitApiError,
} from "@zealakit/core";
import * as ecosystemApi from "@zealakit/core/ecosystem";
import { goEcosystem, registerGoEcosystem } from "@zealakit/ecosystem-go";
import { nodeEcosystem, registerNodeEcosystem } from "@zealakit/ecosystem-node";

describe("programmatic API public exports", () => {
  it("exposes the documented factory, classes, and registration handles", () => {
    assert.equal(typeof createZealakit, "function");
    assert.equal(typeof ZealakitApiError, "function");
    assert.equal(typeof ScaffoldValidationError, "function");
    assert.equal(typeof ScaffoldCommitError, "function");
    assert.equal(typeof registerNodeEcosystem, "function");
    assert.equal(typeof registerGoEcosystem, "function");

    const node: EcosystemRegistration = nodeEcosystem;
    const go: EcosystemRegistration = goEcosystem;
    assert.equal(node.id, "node");
    assert.equal(go.id, "go");
  });

  it("creates a usable instance from public imports", async () => {
    const zealakit: Zealakit = createZealakit({ ecosystems: [nodeEcosystem, goEcosystem] });
    assert.deepEqual([...zealakit.ecosystems].sort(), ["go", "node"]);
    assert.equal(typeof zealakit.metadata.getTemplates, "function");
    assert.equal(typeof zealakit.discovery.getQuestions, "function");
    assert.equal(typeof zealakit.scaffold.plan, "function");
    assert.equal(typeof zealakit.scaffold.create, "function");

    const questions = await zealakit.discovery.getQuestions();
    assert.equal(questions.question?.id, "projectType");
  });

  it("locks the runtime surface of each entry point", () => {
    assert.deepEqual(Object.keys(publicApi).sort(), [
      "DISCOVERY_API_ERROR_CODES",
      "DISCOVERY_API_SCHEMA_VERSION",
      "DISCOVERY_OPERATIONS",
      "ExitCode",
      "ScaffoldCommitError",
      "ScaffoldValidationError",
      "ZealakitApiError",
      "createZealakit",
      "formatDiagnostic",
      "handleDiscoveryRequest",
    ]);
    assert.deepEqual(Object.keys(ecosystemApi).sort(), [
      "assertStagingRealPath",
      "emptyPackagePlan",
      "getNpmManifest",
      "getRecipe",
      "getRecipeAgentEntry",
      "getRecipeDir",
      "getTemplate",
      "getTemplateDevCommand",
      "getTemplateOverlayId",
      "registerRecipe",
      "registerTemplate",
      "resolveStagingPath",
      "setManifestAdapter",
    ]);
  });
});
