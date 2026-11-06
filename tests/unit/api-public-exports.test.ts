import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createZealakit,
  type EcosystemRegistration,
  ScaffoldCommitError,
  ScaffoldValidationError,
  type Zealakit,
  ZealakitApiError,
} from "@zealakit/core";
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
});
