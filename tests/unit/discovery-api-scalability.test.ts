import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_TRAFFIC_EXPECTATIONS,
  getTemplateMatchDiagnostics,
  getVisibleQuestions,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  type ProjectRequirements,
  resolveDiscoveryRequirements,
} from "@zealakit/core";
import { buildTemplateChoices } from "../../apps/cli/src/discovery/present.js";

function fromAnswers(
  answers: Parameters<typeof normalizeDiscoveryAnswers>[0],
): ProjectRequirements {
  const normalized = normalizeDiscoveryAnswers(answers);
  if (!normalized.ok) {
    assert.fail(normalized.errors.join("; "));
  }
  return normalized.requirements;
}

function compatibleIds(result: ReturnType<typeof matchDiscovery>): string[] {
  return result.templates.filter((entry) => entry.compatible).map((entry) => entry.templateId);
}

describe("Backend/API scalability Discovery", () => {
  it("shows the traffic question only for Backend/API", () => {
    const serverIds = getVisibleQuestions({ projectType: "server-api" }).map((q) => q.id);
    assert.ok(serverIds.includes("apiTrafficExpectation"));
    const uiIds = getVisibleQuestions({ projectType: "ui" }).map((q) => q.id);
    assert.ok(!uiIds.includes("apiTrafficExpectation"));
    const workerIds = getVisibleQuestions({ projectType: "background-worker" }).map((q) => q.id);
    assert.ok(!workerIds.includes("apiTrafficExpectation"));
  });

  it("1. low traffic + no technology preference ranks Hono first", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "low",
        backendRuntime: "no-preference",
        apiStorageNeed: "none",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "hono");
  });

  it("2. medium traffic + no technology preference keeps TypeScript first", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "medium",
        backendRuntime: "no-preference",
        apiStorageNeed: "none",
      }),
    );
    assert.equal(result.recommendedTemplateId, "hono");
    assert.ok(compatibleIds(result).includes("nest"));
    assert.ok(compatibleIds(result).includes("gin-api"));
  });

  it("3. high traffic + no technology preference elevates Go without excluding TypeScript", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "high",
        backendRuntime: "no-preference",
        apiStorageNeed: "none",
      }),
    );
    const ids = compatibleIds(result);
    assert.deepEqual(ids, ["gin-api", "stdlib-api", "hono", "nest"]);
    assert.equal(result.recommendedTemplateId, "gin-api");
    assert.ok(ids.includes("hono"));
    const gin = result.templates.find((entry) => entry.templateId === "gin-api");
    assert.ok(gin?.reasons.some((reason) => /high traffic|concurrency/i.test(reason.message)));
  });

  it("4. very high traffic + no technology preference gives Go a clear lead", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "very-high",
        backendRuntime: "no-preference",
        apiStorageNeed: "none",
      }),
    );
    assert.equal(result.recommendedTemplateId, "gin-api");
    const ids = compatibleIds(result);
    assert.ok(ids.indexOf("gin-api") < ids.indexOf("hono"));
    assert.ok(ids.indexOf("stdlib-api") < ids.indexOf("hono"));
    assert.ok(ids.includes("hono"));
    assert.ok(ids.includes("nest"));
  });

  it("5. high traffic + explicit TypeScript preference keeps TypeScript first", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "high",
        backendRuntime: "node",
        apiStorageNeed: "none",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["hono", "nest"]);
    assert.equal(result.recommendedTemplateId, "hono");
  });

  it("6. high traffic + explicit Go preference ranks Gin then stdlib", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "high",
        backendRuntime: "go",
        apiStorageNeed: "none",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["gin-api", "stdlib-api"]);
  });

  it("7. complex business logic + medium traffic keeps Nest competitive", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        serviceGoals: ["business-operations", "manage-accounts", "payments"],
        apiTrafficExpectation: "medium",
        apiStorageNeed: "none",
        backendRuntime: "no-preference",
      }),
    );
    const ids = compatibleIds(result);
    assert.equal(result.recommendedTemplateId, "nest");
    assert.ok(ids.indexOf("nest") < ids.indexOf("gin-api"));
    assert.ok(ids.indexOf("nest") < ids.indexOf("hono"));
    const nest = result.templates.find((entry) => entry.templateId === "nest");
    assert.ok(
      nest?.reasons.some((reason) =>
        /complex business logic|module boundaries/i.test(reason.message),
      ),
    );
  });

  it("8. high traffic + complex business logic still evaluates all four and elevates Go", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        serviceGoals: ["business-operations", "manage-accounts", "payments"],
        apiTrafficExpectation: "high",
        apiStorageNeed: "none",
        backendRuntime: "no-preference",
      }),
    );
    // Go leads on traffic; Nest stays ahead of Hono via business-purpose fit.
    assert.deepEqual(compatibleIds(result), ["gin-api", "stdlib-api", "nest", "hono"]);
    assert.equal(result.recommendedTemplateId, "gin-api");
    assert.ok(compatibleIds(result).includes("nest"));
  });

  it("9. unknown traffic preserves TypeScript-first default", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "server-api",
      apiTrafficExpectation: "no-preference",
      apiStorageNeed: "none",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.equal(resolved.requirements.projectType, "server-api");
    if (resolved.requirements.projectType === "server-api") {
      assert.equal(resolved.requirements.trafficExpectation, undefined);
    }
    const result = matchDiscovery(resolved.requirements);
    assert.equal(result.recommendedTemplateId, "hono");
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
  });

  it("explanations prefer workload-aware copy over generic project matching", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "high",
        apiStorageNeed: "none",
      }),
    );
    const choices = buildTemplateChoices(result);
    assert.match(choices[0]?.hint ?? "", /Go-based HTTP API|concurrent workloads/i);
    assert.doesNotMatch(choices[0]?.hint ?? "", /Matches the kind of project you want to create/);
  });

  it("diagnostics still mark all four API templates discovered and eligible", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiTrafficExpectation: "very-high",
        apiStorageNeed: "none",
      }),
    );
    const diagnostics = getTemplateMatchDiagnostics(result).filter((entry) =>
      ["hono", "nest", "gin-api", "stdlib-api"].includes(entry.templateId),
    );
    assert.equal(diagnostics.length, 4);
    for (const entry of diagnostics) {
      assert.equal(entry.discovered, true);
      assert.equal(entry.eligible, true);
    }
  });

  it("maps every workload level into requirements and keeps Node primary below high", () => {
    for (const level of API_TRAFFIC_EXPECTATIONS) {
      const resolved = resolveDiscoveryRequirements({
        projectType: "server-api",
        apiTrafficExpectation: level,
        apiStorageNeed: "none",
      });
      assert.ok(resolved.ok, level);
      if (!resolved.ok) continue;
      if (resolved.requirements.projectType !== "server-api") continue;
      assert.equal(resolved.requirements.trafficExpectation, level);

      const result = matchDiscovery(resolved.requirements);
      const ids = compatibleIds(result);
      if (level === "low" || level === "medium") {
        assert.equal(result.recommendedTemplateId, "hono", `${level} keeps TypeScript first`);
        assert.ok(ids.includes("gin-api"), `${level} keeps Go eligible`);
      } else {
        // High / very-high may elevate Go, but Node remains a valid recommendation.
        assert.ok(ids.includes("hono"), `${level} keeps Hono eligible`);
        assert.ok(ids.includes("nest"), `${level} keeps Nest eligible`);
        assert.ok(ids.indexOf("gin-api") < ids.indexOf("hono"), `${level} ranks Go above Hono`);
      }
    }
  });
});
