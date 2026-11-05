import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type DiscoveryAnswers,
  getQuestionOptions,
  getVisibleQuestions,
  NO_PREFERENCE,
  normalizeDiscoveryAnswers,
  pruneDiscoveryAnswers,
  validateDiscoveryAnswers,
} from "@zealakit/core";

describe("discovery questionnaire", () => {
  it("requires project type and normalizes no-preference to omitted fields", () => {
    const missing = normalizeDiscoveryAnswers({});
    assert.equal(missing.ok, false);

    const normalized = normalizeDiscoveryAnswers({
      projectType: "web-app",
      purpose: NO_PREFERENCE,
      frontendFramework: "react",
      frontendMode: NO_PREFERENCE,
      capabilities: ["external-api"],
      architectureLevel: "minimal",
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    assert.equal(normalized.requirements.projectType, "web-app");
    assert.equal(normalized.requirements.purpose, undefined);
    assert.equal(normalized.requirements.frontend?.framework, "react");
    assert.equal(normalized.requirements.frontend?.mode, undefined);
    assert.deepEqual(normalized.requirements.capabilities, ["external-api"]);
    assert.equal(normalized.requirements.architectureLevel, "minimal");
  });

  it("shows frontend questions for web apps and backend questions for APIs", () => {
    const web = getVisibleQuestions({ projectType: "web-app" }).map((q) => q.id);
    assert.ok(web.includes("frontendFramework"));
    assert.ok(web.includes("frontendMode"));
    assert.ok(!web.includes("backendRuntime"));

    const api = getVisibleQuestions({ projectType: "api" }).map((q) => q.id);
    assert.ok(api.includes("backendRuntime"));
    assert.ok(!api.includes("frontendFramework"));
    assert.ok(!api.includes("frontendMode"));
  });

  it("re-evaluates conditions and prunes stale answers", () => {
    const withFrontend: DiscoveryAnswers = {
      projectType: "web-app",
      frontendFramework: "react",
      frontendMode: "spa",
    };
    assert.ok(getVisibleQuestions(withFrontend).some((q) => q.id === "frontendMode"));

    const switched = pruneDiscoveryAnswers({
      ...withFrontend,
      projectType: "api",
    });
    assert.equal(switched.frontendFramework, undefined);
    assert.equal(switched.frontendMode, undefined);
    assert.equal(switched.projectType, "api");
  });

  it("narrows backend frameworks by runtime", () => {
    const question = getVisibleQuestions({
      projectType: "api",
      backendRuntime: "go",
    }).find((q) => q.id === "backendFramework");
    assert.ok(question);
    const options = getQuestionOptions(question, {
      projectType: "api",
      backendRuntime: "go",
    }).map((o) => o.value);
    assert.deepEqual(options.sort(), ["gin", "stdlib"]);
  });

  it("validates enum membership and required visible questions", () => {
    const invalid = validateDiscoveryAnswers({
      projectType: "not-real" as DiscoveryAnswers["projectType"],
    });
    assert.equal(invalid.valid, false);

    const valid = validateDiscoveryAnswers({
      projectType: "website",
      frontendFramework: NO_PREFERENCE,
    });
    assert.equal(valid.valid, true, valid.errors.join("\n"));
  });

  it("shows database question only when database capability is selected", () => {
    const without = getVisibleQuestions({
      projectType: "api",
      capabilities: [],
    }).map((q) => q.id);
    assert.ok(!without.includes("databases"));

    const withDb = getVisibleQuestions({
      projectType: "api",
      capabilities: ["database"],
    }).map((q) => q.id);
    assert.ok(withDb.includes("databases"));
  });
});
