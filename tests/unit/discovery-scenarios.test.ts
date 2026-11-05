import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type DiscoveryAnswers,
  formatNoCompatibleTemplateMessage,
  getVisibleQuestions,
  matchDiscovery,
  NO_PREFERENCE,
  normalizeDiscoveryAnswers,
  type ProjectRequirements,
} from "@zealakit/core";
import {
  buildRecipeChoices,
  buildTemplateChoices,
  defaultSelectedRecipeIds,
} from "../../apps/cli/src/discovery/present.js";

const ORM_IDS = new Set(["prisma", "drizzle-orm", "type-orm", "mikro-orm"]);
const BACKEND_TEMPLATE_IDS = new Set(["nest", "hono", "stdlib-api", "gin-api", "stdlib-worker"]);
const FRONTEND_ONLY_IDS = new Set(["vite-react", "vite-vue", "astro-react-client"]);

function requirementsFrom(answers: DiscoveryAnswers): ProjectRequirements {
  const normalized = normalizeDiscoveryAnswers(answers);
  assert.equal(normalized.ok, true, normalized.ok ? "" : normalized.errors.join("\n"));
  assert.ok(normalized.ok);
  return normalized.requirements;
}

function compatibleIds(requirements: ProjectRequirements): string[] {
  return matchDiscovery(requirements)
    .templates.filter((entry) => entry.compatible)
    .map((entry) => entry.templateId);
}

function assertNoBackendRecipes(requirements: ProjectRequirements, templateId: string): void {
  const result = matchDiscovery(requirements, { templateId });
  assert.deepEqual(
    result.recommendedRecipeIds.filter((id) => ORM_IDS.has(id)),
    [],
  );
  assert.ok(
    result.recipes.filter((entry) => entry.relevant).every((entry) => !ORM_IDS.has(entry.recipeId)),
  );
}

describe("discovery scenarios", () => {
  it("A: simple static website prefers Astro client, no backend/ORM", () => {
    const requirements = requirementsFrom({
      projectType: "website",
      frontendMode: "static",
      deploymentTarget: "static-hosting",
      architectureLevel: "minimal",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "astro-react-client");

    const compatible = compatibleIds(requirements);
    assert.ok(compatible.every((id) => !BACKEND_TEMPLATE_IDS.has(id)));
    assert.ok(!compatible.includes("nest"));
    assert.ok(!compatible.includes("stdlib-worker"));

    assert.ok(result.recommendedTemplateId);
    assertNoBackendRecipes(requirements, result.recommendedTemplateId);
    assert.deepEqual(
      defaultSelectedRecipeIds(
        matchDiscovery(requirements, { templateId: result.recommendedTemplateId }),
      ),
      [],
    );
  });

  it("B: React SPA recommends React templates and excludes Vue / backend", () => {
    const requirements = requirementsFrom({
      projectType: "web-app",
      frontendFramework: "react",
      frontendMode: "spa",
      architectureLevel: "balanced",
    });
    const result = matchDiscovery(requirements);
    const compatible = compatibleIds(requirements);

    assert.ok(result.recommendedTemplateId);
    assert.ok(["vite-react", "next", "astro-react-hybrid"].includes(result.recommendedTemplateId));
    // Balanced + SPA favors Next over minimal Vite (architecture preference, not a hard bug).
    assert.equal(result.recommendedTemplateId, "next");

    assert.ok(compatible.includes("vite-react"));
    assert.ok(!compatible.includes("vite-vue"));
    assert.ok(!compatible.includes("nuxt"));
    assert.ok(compatible.every((id) => !["nest", "hono", "stdlib-api", "gin-api"].includes(id)));

    assertNoBackendRecipes(requirements, result.recommendedTemplateId);
  });

  it("B (minimal SPA): prefers Vite when architecture is minimal", () => {
    const requirements = requirementsFrom({
      projectType: "web-app",
      frontendFramework: "react",
      frontendMode: "spa",
      architectureLevel: "minimal",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "vite-react");
  });

  it("C: fullstack SaaS with Postgres recommends hybrid/fullstack + one ORM", () => {
    // Auth is not a registered capability yet — cover database + React + Node instead.
    const requirements = requirementsFrom({
      projectType: "fullstack",
      purpose: "saas",
      frontendFramework: "react",
      backendRuntime: "node",
      capabilities: ["database"],
      databases: ["postgresql"],
      architectureLevel: "balanced",
    });
    const result = matchDiscovery(requirements);
    const compatible = compatibleIds(requirements);

    assert.ok(result.recommendedTemplateId);
    assert.ok(["next", "astro-react-hybrid"].includes(result.recommendedTemplateId));
    assert.ok(!compatible.some((id) => FRONTEND_ONLY_IDS.has(id)));
    assert.ok(!compatible.includes("stdlib-worker"));

    const withTemplate = matchDiscovery(requirements, {
      templateId: result.recommendedTemplateId,
    });
    const orms = withTemplate.recommendedRecipeIds.filter((id) => ORM_IDS.has(id));
    assert.equal(orms.length, 1);

    const choices = buildRecipeChoices(withTemplate);
    assert.ok(choices.some((choice) => ORM_IDS.has(choice.value)));
    assert.ok(!choices.some((choice) => choice.value === "biome"));
  });

  it("D: lightweight Node API excludes frontend and does not auto-add ORM", () => {
    const requirements = requirementsFrom({
      projectType: "api",
      backendRuntime: "node",
      architectureLevel: "minimal",
    });
    const result = matchDiscovery(requirements);
    const compatible = compatibleIds(requirements);

    assert.ok(result.recommendedTemplateId);
    assert.ok(["hono", "nest"].includes(result.recommendedTemplateId));
    assert.ok(compatible.every((id) => ["hono", "nest"].includes(id)));
    assert.ok(
      !compatible.some((id) => FRONTEND_ONLY_IDS.has(id) || id === "next" || id === "nuxt"),
    );

    assert.ok(result.recommendedTemplateId);
    assertNoBackendRecipes(requirements, result.recommendedTemplateId);
  });

  it("E: Go API recommends Go templates only", () => {
    const requirements = requirementsFrom({
      projectType: "api",
      backendRuntime: "go",
      architectureLevel: "balanced",
    });
    const result = matchDiscovery(requirements);
    const compatible = compatibleIds(requirements);

    assert.equal(result.recommendedTemplateId, "gin-api");
    assert.deepEqual(compatible.sort(), ["gin-api", "stdlib-api"].sort());
    assert.ok(!compatible.includes("nest"));
    assert.ok(!compatible.includes("hono"));

    const recipes = matchDiscovery(requirements, { templateId: "gin-api" });
    assert.deepEqual(recipes.recommendedRecipeIds, []);
    assert.ok(recipes.recipes.every((entry) => !entry.relevant || entry.role === "excluded"));
  });

  it("F: background worker recommends stdlib-worker only", () => {
    const requirements = requirementsFrom({
      projectType: "worker",
      backendRuntime: "go",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "stdlib-worker");
    assert.deepEqual(compatibleIds(requirements), ["stdlib-worker"]);

    const recipes = matchDiscovery(requirements, { templateId: "stdlib-worker" });
    assert.deepEqual(recipes.recommendedRecipeIds, []);
    assert.ok(!recipes.recipes.some((entry) => entry.relevant && entry.recipeId === "mui"));
  });

  it("G: no technical preference still ranks without inventing constraints", () => {
    const requirements = requirementsFrom({
      projectType: "web-app",
      frontendFramework: NO_PREFERENCE,
      frontendMode: NO_PREFERENCE,
      architectureLevel: "balanced",
    });
    const result = matchDiscovery(requirements);
    const choices = buildTemplateChoices(result);

    assert.ok(result.recommendedTemplateId);
    assert.ok(choices.length >= 2);
    assert.ok(choices.every((choice) => choice.match.compatible));
    // Missing prefs must not zero-out scores for compatible templates.
    assert.ok(choices.every((choice) => choice.match.score > 0));

    const second = matchDiscovery(requirements);
    assert.deepEqual(
      second.templates.map((entry) => [entry.templateId, entry.score, entry.compatible]),
      result.templates.map((entry) => [entry.templateId, entry.score, entry.compatible]),
    );
  });

  it("H: unsupported UI framework yields no compatible template + clear message", () => {
    const requirements = requirementsFrom({
      projectType: "web-app",
      frontendFramework: "svelte",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, undefined);
    assert.deepEqual(compatibleIds(requirements), []);
    assert.equal(buildTemplateChoices(result).length, 0);

    const message = formatNoCompatibleTemplateMessage(result);
    assert.match(message, /No compatible template/i);
    assert.match(message, /svelte/i);
  });

  it("questionnaire: rendering mode stays available without a UI library preference", () => {
    const visible = getVisibleQuestions({
      projectType: "website",
      frontendFramework: NO_PREFERENCE,
    }).map((question) => question.id);
    assert.ok(visible.includes("frontendMode"));
  });

  it("never recommends incompatible templates in CLI choices", () => {
    const requirements = requirementsFrom({
      projectType: "api",
      frontendFramework: "react",
      capabilities: ["web-ui"],
    });
    const result = matchDiscovery(requirements);
    for (const choice of buildTemplateChoices(result)) {
      assert.equal(choice.match.compatible, true);
    }
    if (result.recommendedTemplateId) {
      const pick = result.templates.find(
        (entry) => entry.templateId === result.recommendedTemplateId,
      );
      assert.ok(pick?.compatible);
    }
  });
});
