import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNoCompatibleTemplateMessage,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  type ProjectRequirements,
} from "@zealakit/core";
import {
  buildTemplateChoices,
  defaultSelectedRecipeIds,
} from "../../apps/cli/src/discovery/present.js";

function fromAnswers(
  answers: Parameters<typeof normalizeDiscoveryAnswers>[0],
): ProjectRequirements {
  const normalized = normalizeDiscoveryAnswers(answers);
  if (!normalized.ok) {
    assert.fail(normalized.errors.join("; "));
  }
  return normalized.requirements;
}

describe("discovery scenarios", () => {
  it("A: content / blog site with Astro prefers Astro client, no backend/ORM", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "blog-content",
      contentChangeFrequency: "rarely",
      uiTechPreference: "astro",
      uiDataNeed: "predefined",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "astro-react-client");
    assert.ok(!result.recommendedRecipeIds.some((id) => id.includes("orm")));
    assert.ok(!compatibleHas(result, "nest"));
  });

  it("B: React interactive dashboard prefers React SPA templates and excludes Vue / backend", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiTechPreference: "react",
      contentChangeFrequency: "occasionally",
      uiDataNeed: "predefined",
    });
    const result = matchDiscovery(requirements);
    const ids = compatibleIds(result);
    assert.ok(ids.includes("vite-react"));
    assert.ok(!ids.includes("vite-vue"));
    assert.ok(!ids.includes("nest"));
    assert.equal(result.recommendedTemplateId, "vite-react");
  });

  it("C: frequently updated business site keeps Vite eligible and ranks content-oriented React starters", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "business-marketing",
      uiTechPreference: "react",
      contentChangeFrequency: "frequently",
    });
    const result = matchDiscovery(requirements);
    const ids = compatibleIds(result);
    assert.ok(ids.includes("vite-react"));
    assert.ok(ids.includes("astro-react-client"));
    assert.ok(ids.includes("next"));
    assert.ok(!ids.includes("vite-vue"));
    assert.ok(
      result.recommendedTemplateId === "astro-react-client" ||
        result.recommendedTemplateId === "vite-react",
    );
  });

  it("D: lightweight Node API excludes frontend and does not auto-add ORM", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      backendRuntime: "node",
      apiStorageNeed: "none",
    });
    const result = matchDiscovery(requirements);
    assert.ok(!compatibleHas(result, "vite-react"));
    assert.ok(result.recommendedTemplateId === "hono" || result.recommendedTemplateId === "nest");
    assert.ok(!result.recommendedRecipeIds.some((id) => id.includes("orm") || id === "prisma"));
  });

  it("E: Go API recommends Go templates only, Gin first", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      backendRuntime: "go",
    });
    const result = matchDiscovery(requirements);
    const ids = compatibleIds(result);
    assert.deepEqual(ids, ["gin-api", "stdlib-api"]);
    assert.ok(!compatibleHas(result, "nest"));
    assert.ok(!compatibleHas(result, "hono"));
  });

  it("E2: no technology preference ranks Node first while keeping Go eligible", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      backendRuntime: "no-preference",
      apiStorageNeed: "none",
    });
    const result = matchDiscovery(requirements);
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "hono");
  });

  it("E3: TypeScript preference excludes Go", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      backendRuntime: "node",
    });
    const result = matchDiscovery(requirements);
    assert.deepEqual(compatibleIds(result), ["hono", "nest"]);
  });

  it("E4: structured database keeps Go eligible behind Node (no Go ORM recipes yet)", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      apiStorageNeed: "relational",
    });
    const result = matchDiscovery(requirements);
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
    assert.equal(result.recommendedTemplateId, "hono");
    const go = result.templates.find((entry) => entry.templateId === "gin-api");
    assert.ok(go?.compatible);
    assert.ok(go?.warnings.some((warning) => /database recipe/i.test(warning)));
  });

  it("E5: auth and background notes do not exclude Go alternatives", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      apiAuthNeed: "roles",
      apiBackgroundNeed: "background",
      apiStorageNeed: "none",
    });
    const result = matchDiscovery(requirements);
    assert.deepEqual(compatibleIds(result), ["hono", "nest", "gin-api", "stdlib-api"]);
  });

  it("F: background worker recommends stdlib-worker only", () => {
    const requirements = fromAnswers({
      projectType: "background-worker",
      backendRuntime: "go",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "stdlib-worker");
    assert.deepEqual(compatibleIds(result), ["stdlib-worker"]);
  });

  it("G: no technical preference still ranks without inventing constraints", () => {
    const requirements = fromAnswers({ projectType: "ui" });
    const result = matchDiscovery(requirements);
    assert.ok(result.recommendedTemplateId);
    assert.ok(compatibleIds(result).length > 1);
  });

  it("H: unsupported UI framework yields no compatible template + clear message", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      uiTechPreference: "svelte",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, undefined);
    assert.match(formatNoCompatibleTemplateMessage(result), /No compatible template/i);
  });

  it("I: API with structured storage never lands on a frontend-only template", () => {
    const requirements = fromAnswers({
      projectType: "server-api",
      apiStorageNeed: "relational",
      backendRuntime: "node",
    });
    const result = matchDiscovery(requirements);
    assert.ok(!compatibleHas(result, "vite-react"));
    assert.ok(result.recommendedRecipeIds.length >= 1);
  });

  it("I2: UI that includes server/data in-project excludes frontend-only starters", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiDataNeed: "store-retrieve",
      uiBackendApproach: "include-server",
      uiTechPreference: "react",
    });
    const result = matchDiscovery(requirements);
    assert.ok(!compatibleHas(result, "vite-react"));
    assert.ok(!compatibleHas(result, "vite-vue"));
    assert.ok(
      compatibleIds(result).some((id) => ["next", "nuxt", "astro-react-hybrid"].includes(id)),
    );
  });

  it("I3: dashboard with auth/data and no preference ranks React ecosystem first", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      userAccounts: "roles",
      uiDataNeed: "store-retrieve",
      uiBackendApproach: "ui-only",
      contentChangeFrequency: "occasionally",
      uiTechPreference: "no-preference",
    });
    const result = matchDiscovery(requirements);
    assert.ok(compatibleHas(result, "vite-react"));
    assert.ok(compatibleHas(result, "vite-vue"));
    assert.ok(compatibleHas(result, "next"));
    assert.equal(result.recommendedTemplateId, "vite-react");
    const ranked = compatibleIds(result).filter((id) =>
      [
        "vite-react",
        "next",
        "astro-react-client",
        "vite-vue",
        "nuxt",
        "astro-react-hybrid",
      ].includes(id),
    );
    assert.deepEqual(ranked, [
      "vite-react",
      "next",
      "astro-react-client",
      "vite-vue",
      "nuxt",
      "astro-react-hybrid",
    ]);
  });

  it("I4: dashboard with React preference keeps Vite React ahead of Next", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiTechPreference: "react",
      uiBackendApproach: "ui-only",
      uiDataNeed: "store-retrieve",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "vite-react");
    const ranked = compatibleIds(result);
    assert.ok(ranked.indexOf("vite-react") < ranked.indexOf("next"));
    assert.ok(!ranked.includes("vite-vue"));
  });

  it("I5: dashboard with Vue preference ranks Vite Vue then Nuxt", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiTechPreference: "vue",
      uiBackendApproach: "ui-only",
      uiDataNeed: "store-retrieve",
    });
    const result = matchDiscovery(requirements);
    assert.equal(result.recommendedTemplateId, "vite-vue");
    const ranked = compatibleIds(result);
    assert.deepEqual(ranked, ["vite-vue", "nuxt"]);
  });

  it("I6: hard SSR requirement excludes client-only starters", () => {
    const requirements: ProjectRequirements = {
      projectType: "ui",
      scopes: [],
      capabilities: [],
      frontend: { mode: "ssr" },
    };
    const result = matchDiscovery(requirements);
    assert.ok(!compatibleHas(result, "vite-react"));
    assert.ok(!compatibleHas(result, "vite-vue"));
    assert.ok(!compatibleHas(result, "astro-react-client"));
    assert.ok(compatibleHas(result, "next"));
    assert.ok(compatibleHas(result, "nuxt"));
    assert.ok(compatibleHas(result, "astro-react-hybrid"));
  });

  it("I7: ui-only backend approach does not require embedded server capabilities", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiDataNeed: "store-retrieve",
      uiBackendApproach: "ui-only",
    });
    assert.ok(requirements.projectType === "ui");
    assert.equal(requirements.externalApi, true);
    assert.ok(!requirements.capabilities.includes("database"));
    const result = matchDiscovery(requirements);
    assert.ok(compatibleHas(result, "vite-react"));
    assert.ok(compatibleHas(result, "next"));
    assert.equal(result.recommendedTemplateId, "vite-react");
  });

  it("J: Complete Product cannot normalize into recommendations", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "complete-product",
    });
    assert.equal(normalized.ok, false);
  });

  it("never recommends incompatible templates in CLI choices", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      uiTechPreference: "react",
    });
    const result = matchDiscovery(requirements);
    const choices = buildTemplateChoices(result);
    assert.ok(choices.every((choice) => choice.match.compatible));
    assert.equal(choices[0]?.value, result.recommendedTemplateId);
    const withTemplate = matchDiscovery(requirements, {
      templateId: result.recommendedTemplateId,
    });
    const selected = defaultSelectedRecipeIds(withTemplate);
    assert.ok(selected.every((id) => withTemplate.recommendedRecipeIds.includes(id)));
  });
});

function compatibleIds(result: ReturnType<typeof matchDiscovery>): string[] {
  return result.templates.filter((entry) => entry.compatible).map((entry) => entry.templateId);
}

function compatibleHas(result: ReturnType<typeof matchDiscovery>, id: string): boolean {
  return compatibleIds(result).includes(id);
}
