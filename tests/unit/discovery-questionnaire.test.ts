import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCOVERY_QUESTIONS,
  type DiscoveryAnswers,
  formatUnsupportedProjectTypeMessage,
  getQuestionOptions,
  getVisibleQuestions,
  NO_PREFERENCE,
  normalizeDiscoveryAnswers,
  PROJECT_TYPES,
  pruneDiscoveryAnswers,
  resolveDiscoveryRequirements,
  validateDiscoveryAnswers,
} from "@zealakit/core";

describe("discovery questionnaire branching", () => {
  it("root question lists all four project types with plain-language labels", () => {
    const root = getVisibleQuestions({})[0];
    assert.equal(root?.id, "projectType");
    assert.equal(root?.prompt, "What do you want to create?");
    assert.deepEqual(
      root?.options.map((option) => option.value),
      ["ui", "server-api", "background-worker", "complete-product"],
    );
    assert.deepEqual(
      root?.options.map((option) => option.value),
      [...PROJECT_TYPES],
    );
    assert.equal(root?.options.find((option) => option.value === "ui")?.label, "UI / Website");
    assert.equal(
      root?.options.find((option) => option.value === "server-api")?.label,
      "Backend / API Service",
    );
    assert.equal(
      root?.options.find((option) => option.value === "background-worker")?.label,
      "Background / Worker",
    );
    assert.equal(
      root?.options.find((option) => option.value === "complete-product")?.label,
      "Complete Product",
    );
    assert.match(
      root?.options.find((option) => option.value === "complete-product")?.hint ?? "",
      /coming soon/i,
    );
  });

  it("default catalog avoids SPA/SSR/ORM/architecture jargon", () => {
    const text = DISCOVERY_QUESTIONS.flatMap((question) => [
      question.prompt,
      question.description ?? "",
      ...question.options.flatMap((option) => [option.label, option.hint ?? ""]),
    ])
      .join("\n")
      .toLowerCase();
    for (const banned of ["spa", "ssr", "ssg", "hybrid", "orm", "graphql", "rpc"]) {
      const re = new RegExp(`\\b${banned}\\b`, "i");
      assert.equal(re.test(text), false, `catalog should not mention '${banned}'`);
    }
    assert.ok(
      !DISCOVERY_QUESTIONS.some((question) => question.id === ("architectureLevel" as never)),
    );
  });

  it("UI selection only activates UI questions", () => {
    const ids = getVisibleQuestions({ projectType: "ui" }).map((q) => q.id);
    assert.ok(ids.includes("websiteKind"));
    assert.ok(ids.includes("visitorActions"));
    assert.ok(ids.includes("contentChangeFrequency"));
    assert.ok(ids.includes("uiTechPreference"));
    assert.ok(!ids.includes("serviceGoals"));
    assert.ok(!ids.includes("workerTasks"));
    assert.ok(!ids.includes("backendRuntime"));
  });

  it("Server/API selection only activates server questions", () => {
    const ids = getVisibleQuestions({ projectType: "server-api" }).map((q) => q.id);
    assert.ok(ids.includes("serviceGoals"));
    assert.ok(ids.includes("apiStorageNeed"));
    assert.ok(ids.includes("apiTrafficExpectation"));
    assert.ok(ids.includes("backendRuntime"));
    assert.ok(!ids.includes("websiteKind"));
    assert.ok(!ids.includes("workerTasks"));
  });

  it("Worker selection only activates worker questions", () => {
    const ids = getVisibleQuestions({ projectType: "background-worker" }).map((q) => q.id);
    assert.ok(ids.includes("workerTasks"));
    assert.ok(ids.includes("workerSchedule"));
    assert.ok(ids.includes("backendRuntime"));
    assert.ok(!ids.includes("websiteKind"));
    assert.ok(!ids.includes("serviceGoals"));
  });

  it("Complete Product has no follow-up questions and a clear message", () => {
    const ids = getVisibleQuestions({ projectType: "complete-product" }).map((q) => q.id);
    assert.deepEqual(ids, ["projectType"]);
    assert.match(formatUnsupportedProjectTypeMessage(), /not supported yet/i);
    const normalized = normalizeDiscoveryAnswers({
      projectType: "complete-product",
    });
    assert.equal(normalized.ok, false);
  });

  it("changing root selection clears incompatible answers", () => {
    const pruned = pruneDiscoveryAnswers({
      projectType: "server-api",
      websiteKind: "portfolio",
      visitorActions: ["read-information"],
      backendRuntime: "node",
    });
    assert.equal(pruned.projectType, "server-api");
    assert.equal(pruned.websiteKind, undefined);
    assert.equal(pruned.visitorActions, undefined);
    assert.equal(pruned.backendRuntime, "node");
  });

  it("shows account and data questions only for interactive UI intents", () => {
    const marketing = getVisibleQuestions({
      projectType: "ui",
      websiteKind: "business-marketing",
    }).map((q) => q.id);
    assert.ok(!marketing.includes("userAccounts"));
    assert.ok(!marketing.includes("uiDataNeed"));

    const dashboard = getVisibleQuestions({
      projectType: "ui",
      websiteKind: "management-dashboard",
    }).map((q) => q.id);
    assert.ok(dashboard.includes("userAccounts"));
    assert.ok(dashboard.includes("uiDataNeed"));
  });

  it("shows auth follow-up for APIs that manage accounts or structured data", () => {
    const plain = getVisibleQuestions({
      projectType: "server-api",
      apiStorageNeed: "none",
    }).map((q) => q.id);
    assert.ok(!plain.includes("apiAuthNeed"));

    const accounts = getVisibleQuestions({
      projectType: "server-api",
      serviceGoals: ["manage-accounts"],
    }).map((q) => q.id);
    assert.ok(accounts.includes("apiAuthNeed"));
  });

  it("filters backend frameworks by runtime and worker availability", () => {
    const nodeAnswers = { projectType: "server-api" as const, backendRuntime: "node" as const };
    const nodeQuestion = getVisibleQuestions(nodeAnswers).find((q) => q.id === "backendFramework");
    assert.ok(nodeQuestion);
    assert.deepEqual(
      getQuestionOptions(nodeQuestion, nodeAnswers)
        .map((o) => o.value)
        .sort(),
      ["hono", "nest"],
    );

    const goAnswers = {
      projectType: "background-worker" as const,
      backendRuntime: "go" as const,
    };
    const goQuestion = getVisibleQuestions(goAnswers).find((q) => q.id === "backendFramework");
    assert.ok(goQuestion);
    assert.deepEqual(
      getQuestionOptions(goQuestion, goAnswers).map((o) => o.value),
      ["stdlib"],
    );

    const nodeWorkerAnswers = {
      projectType: "background-worker" as const,
      backendRuntime: "node" as const,
    };
    const nodeWorkerQuestion = getVisibleQuestions(nodeWorkerAnswers).find(
      (q) => q.id === "backendFramework",
    );
    assert.ok(nodeWorkerQuestion);
    assert.equal(getQuestionOptions(nodeWorkerQuestion, nodeWorkerAnswers).length, 0);
  });

  it("validates enum membership and required project type", () => {
    assert.equal(validateDiscoveryAnswers({}).valid, false);
    assert.equal(
      validateDiscoveryAnswers({
        projectType: "not-real" as DiscoveryAnswers["projectType"],
      }).valid,
      false,
    );
    assert.equal(validateDiscoveryAnswers({ projectType: "ui" }).valid, true);
  });
});

describe("discovery requirement resolver", () => {
  it("infers UI technical requirements without treating uncertainty as negatives", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "ui",
      websiteKind: "management-dashboard",
      userAccounts: "sign-in",
      uiDataNeed: "user-managed",
      contentChangeFrequency: "frequently",
      uiTechPreference: NO_PREFERENCE,
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "ui");
    if (resolved.requirements.projectType !== "ui") return;
    assert.equal(resolved.requirements.frontend?.mode, undefined);
    assert.equal(resolved.requirements.frontend?.preferredMode, "spa");
    assert.equal(resolved.requirements.frontend?.framework, undefined);
    assert.equal(resolved.requirements.purpose, "internal-tool");
    assert.ok(!resolved.requirements.capabilities.includes("database"));
    assert.equal(resolved.requirements.externalApi, true);
    assert.ok(
      resolved.notes.some(
        (note) => note.field === "frontend.preferredMode" && note.source === "inferred",
      ),
    );
    assert.ok(resolved.notes.some((note) => note.field === "authentication"));
  });

  it("keeps external API consumption distinct from generating a backend", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "ui",
      websiteKind: "landing-page",
      visitorActions: ["call-existing-api", "read-information"],
      uiDataNeed: "predefined",
      uiTechPreference: "react",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "ui");
    if (resolved.requirements.projectType !== "ui") return;
    assert.equal(resolved.requirements.externalApi, true);
    assert.ok(!resolved.requirements.capabilities.includes("database"));
    assert.equal(resolved.requirements.frontend?.framework, "react");
  });

  it("maps Astro preference to delivery and content sites toward soft static preference", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "ui",
      websiteKind: "blog-content",
      contentChangeFrequency: "rarely",
      uiTechPreference: "astro",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "ui");
    if (resolved.requirements.projectType !== "ui") return;
    assert.equal(resolved.requirements.frontend?.delivery, "astro");
    assert.equal(resolved.requirements.frontend?.framework, undefined);
    assert.equal(resolved.requirements.frontend?.mode, undefined);
    assert.equal(resolved.requirements.frontend?.preferredMode, "ssg");
    assert.equal(resolved.requirements.purpose, "content-platform");
  });

  it("resolves relational API storage into SQL + ORM interest", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "server-api",
      serviceGoals: ["store-retrieve"],
      apiStorageNeed: "relational",
      backendRuntime: "node",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "server-api");
    if (resolved.requirements.projectType !== "server-api") return;
    assert.equal(resolved.requirements.databaseKind, "sql");
    assert.ok(resolved.requirements.capabilities.includes("database"));
    assert.ok(resolved.requirements.recipeInterests?.includes("orm"));
    assert.equal(resolved.requirements.backend?.runtime, "node");
    assert.equal(resolved.requirements.serviceType, "rest");
  });

  it("does not invent database constraints from unanswered storage", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "server-api",
      backendRuntime: "node",
      apiStorageNeed: NO_PREFERENCE,
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.ok(!resolved.requirements.capabilities.includes("database"));
    assert.equal(
      "databaseKind" in resolved.requirements ? resolved.requirements.databaseKind : undefined,
      undefined,
    );
  });

  it("maps worker schedules and keeps volume informational", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "background-worker",
      workerSchedule: "scheduled",
      workerVolume: "large",
      workerDataNeed: "none",
      backendRuntime: "go",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "background-worker");
    if (resolved.requirements.projectType !== "background-worker") return;
    assert.equal(resolved.requirements.processingModel, "scheduled");
    assert.ok(!resolved.requirements.capabilities.includes("database"));
    assert.ok(resolved.notes.some((note) => note.field === "volume" && note.source === "explicit"));
  });

  it("normalizeDiscoveryAnswers delegates to the resolver", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "ui",
      uiTechPreference: NO_PREFERENCE,
      contentChangeFrequency: NO_PREFERENCE,
    });
    assert.ok(normalized.ok);
    if (!normalized.ok) return;
    assert.equal(normalized.requirements.projectType, "ui");
    if (normalized.requirements.projectType !== "ui") return;
    assert.equal(normalized.requirements.frontend, undefined);
  });
});
