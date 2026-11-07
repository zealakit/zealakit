import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE,
  formatNoCompatibleTemplateMessage,
  getTemplateMatchDiagnostics,
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

describe("Backend/API Discovery coverage", () => {
  it("declares Node-first backend ecosystem preference once", () => {
    assert.deepEqual(DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE, ["node", "go"]);
  });

  it("no preference keeps Go in the pool behind TypeScript starters", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        backendRuntime: "no-preference",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "hono");
    const choices = buildTemplateChoices(result);
    assert.match(choices[0]?.hint ?? "", /Lightweight API · TypeScript/);
    assert.match(choices[2]?.hint ?? "", /Go HTTP framework · Go/);
    assert.match(choices[3]?.hint ?? "", /Minimal dependencies · Go/);
  });

  it("explicit Go preference ranks Gin then Standard Library and excludes Node", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        backendRuntime: "go",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "gin-api");
  });

  it("explicit TypeScript preference ranks Hono then Nest and excludes Go", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        backendRuntime: "node",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["hono", "nest"]);
  });

  it("lightweight API with no storage prefers Hono while keeping Go visible", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiStorageNeed: "none",
        serviceGoals: ["serve-clients"],
      }),
    );
    assert.equal(result.recommendedTemplateId, "hono");
    assert.ok(compatibleIds(result).includes("gin-api"));
    assert.ok(compatibleIds(result).includes("stdlib-api"));
  });

  it("general business API without storage keeps the full Node+Go pool", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        serviceGoals: ["business-operations", "manage-accounts"],
        apiStorageNeed: "none",
      }),
    );
    // Nest leads on inferred business purpose; Go remains eligible behind TypeScript.
    assert.deepEqual(compatibleIds(result), ["nest", "hono", "gin-api", "stdlib-api"]);
  });

  it("structured database keeps Go in the pool with warnings and Node ranked first", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiStorageNeed: "relational",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "hono");
  });

  it("flexible/NoSQL storage remains unsupported for all API templates", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        apiStorageNeed: "flexible",
      }),
    );
    assert.equal(result.recommendedTemplateId, undefined);
    assert.match(formatNoCompatibleTemplateMessage(result), /No compatible template/i);
  });

  it("authentication preference does not invent auth recipes or drop Go", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "server-api",
      apiAuthNeed: "roles",
      apiStorageNeed: "none",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.ok(resolved.notes.some((note) => note.field === "authentication"));
    const result = matchDiscovery(resolved.requirements);
    assert.ok(compatibleIds(result).includes("gin-api"));
  });

  it("background work preference records a note and still recommends an API starter", () => {
    const resolved = resolveDiscoveryRequirements({
      projectType: "server-api",
      apiBackgroundNeed: "queue",
      apiStorageNeed: "none",
    });
    assert.ok(resolved.ok);
    if (!resolved.ok) return;
    assert.ok(resolved.notes.some((note) => note.field === "background"));
    const result = matchDiscovery(resolved.requirements);
    assert.equal(result.recommendedTemplateId, "hono");
    assert.ok(!compatibleIds(result).includes("stdlib-worker"));
  });

  it("Go + database uses the postgres recipe", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        backendRuntime: "go",
        apiStorageNeed: "relational",
      }),
    );
    assert.deepEqual(compatibleIds(result), ["gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "gin-api");
    assert.ok(result.recommendedRecipeIds.includes("postgres"));
    const gin = result.templates.find((entry) => entry.templateId === "gin-api");
    assert.ok(!gin?.warnings.some((warning) => /database recipe/i.test(warning)));
  });

  it("full business API scenario discovers and ranks all four Backend/API templates", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "server-api",
        serviceGoals: [
          "manage-accounts",
          "store-retrieve",
          "payments",
          "connect-external",
          "business-operations",
        ],
        serviceConsumers: "external-developers",
        apiStorageNeed: "relational",
        apiAuthNeed: "roles",
        apiBackgroundNeed: "background",
        backendRuntime: "no-preference",
      }),
    );
    // Business goals elevate Nest among TypeScript starters; Go stays eligible.
    assert.deepEqual(compatibleIds(result), ["nest", "hono", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "nest");

    const diagnostics = getTemplateMatchDiagnostics(result).filter((entry) =>
      ["hono", "nest", "gin-api", "stdlib-api"].includes(entry.templateId),
    );
    assert.equal(diagnostics.length, 4);
    for (const entry of diagnostics) {
      assert.equal(entry.discovered, true);
      assert.equal(entry.eligible, true);
      assert.ok(typeof entry.score === "number");
    }
    const gin = diagnostics.find((entry) => entry.templateId === "gin-api");
    assert.equal(gin?.ecosystem, "go");
    assert.ok(!gin?.warnings.some((warning) => /database recipe/i.test(warning)));
  });
});
