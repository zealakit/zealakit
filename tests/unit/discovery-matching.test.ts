import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchDiscovery,
  type ProjectRequirements,
  RECIPE_SCORE_WEIGHTS,
  TEMPLATE_SCORE_WEIGHTS,
} from "@zealakit/core";

function req(
  partial: Partial<ProjectRequirements> & Pick<ProjectRequirements, "projectType">,
): ProjectRequirements {
  return {
    scopes: [],
    capabilities: [],
    ...partial,
  };
}

function assertScoreBounds(score: number): void {
  assert.ok(score >= 0 && score <= 100, `score out of range: ${score}`);
}

describe("template matching", () => {
  it("ranks exact project type matches and prefers simpler templates on ties", () => {
    const first = matchDiscovery(req({ projectType: "web-app" }));
    const second = matchDiscovery(req({ projectType: "web-app" }));
    assert.deepEqual(first, second);

    assert.ok(first.recommendedTemplateId);
    const compatible = first.templates.filter((entry) => entry.compatible);
    assert.ok(compatible.length > 0);
    for (const entry of compatible) {
      assertScoreBounds(entry.score);
      assert.ok(entry.reasons.some((reason) => reason.code === "project-type-match"));
    }

    // vite-* (minimal) should beat hybrid/fullstack-capable templates when both match web-app
    const recommended = first.recommendedTemplateId;
    assert.ok(recommended && ["vite-react", "vite-vue"].includes(recommended), recommended);
  });

  it("rejects incompatible project types", () => {
    const result = matchDiscovery(req({ projectType: "api" }));
    const vite = result.templates.find((entry) => entry.templateId === "vite-react");
    assert.ok(vite);
    assert.equal(vite.compatible, false);
    assert.ok(vite.reasons.some((reason) => reason.code === "project-type-mismatch"));
    assert.ok(!result.recommendedRecipeIds.includes("mui"));
  });

  it("handles frontend-only projects", () => {
    const result = matchDiscovery(
      req({
        projectType: "website",
        frontend: { framework: "react" },
      }),
    );
    assert.ok(result.recommendedTemplateId);
    const pick = result.templates.find(
      (entry) => entry.templateId === result.recommendedTemplateId,
    );
    assert.ok(pick?.compatible);
    assert.ok(pick.reasons.some((reason) => reason.code === "frontend-framework-match"));

    for (const entry of result.templates.filter((item) => item.compatible)) {
      assert.ok(
        ["vite-react", "astro-react-client", "astro-react-hybrid", "next"].includes(
          entry.templateId,
        ),
      );
    }
    assert.equal(result.templates.find((entry) => entry.templateId === "nest")?.compatible, false);
  });

  it("handles backend-only API projects", () => {
    const result = matchDiscovery(req({ projectType: "api" }));
    assert.ok(result.recommendedTemplateId);
    const compatibleIds = result.templates.filter((e) => e.compatible).map((e) => e.templateId);
    assert.ok(compatibleIds.includes("nest") || compatibleIds.includes("hono"));
    assert.ok(compatibleIds.includes("stdlib-api") || compatibleIds.includes("gin-api"));
    assert.equal(
      result.templates.find((entry) => entry.templateId === "vite-react")?.compatible,
      false,
    );
  });

  it("handles fullstack projects requiring web-ui and http-api", () => {
    const result = matchDiscovery(req({ projectType: "fullstack" }));
    const compatible = result.templates
      .filter((entry) => entry.compatible)
      .map((e) => e.templateId);
    assert.ok(compatible.includes("next") || compatible.includes("nuxt"));
    assert.equal(compatible.includes("vite-react"), false);
    assert.equal(compatible.includes("nest"), false);
  });

  it("applies explicit framework and runtime preferences as hard constraints", () => {
    const react = matchDiscovery(req({ projectType: "web-app", frontend: { framework: "vue" } }));
    assert.equal(react.templates.find((e) => e.templateId === "vite-react")?.compatible, false);
    assert.ok(react.templates.find((e) => e.templateId === "vite-vue")?.compatible);

    const go = matchDiscovery(
      req({ projectType: "api", backend: { runtime: "go", framework: "gin" } }),
    );
    assert.equal(go.recommendedTemplateId, "gin-api");
    assert.equal(go.templates.find((e) => e.templateId === "nest")?.compatible, false);
  });

  it("does not treat missing optional preferences as hard constraints", () => {
    const withPrefs = matchDiscovery(
      req({
        projectType: "api",
        architectureLevel: "structured",
        deploymentTarget: "container",
      }),
    );
    const withoutPrefs = matchDiscovery(req({ projectType: "api" }));

    const withIds = new Set(
      withPrefs.templates.filter((e) => e.compatible).map((e) => e.templateId),
    );
    const withoutIds = new Set(
      withoutPrefs.templates.filter((e) => e.compatible).map((e) => e.templateId),
    );
    for (const id of withIds) {
      assert.ok(withoutIds.has(id), id);
    }
    assert.ok(withoutPrefs.recommendedTemplateId);
  });

  it("fails when a template-owned capability is missing", () => {
    const result = matchDiscovery(
      req({
        projectType: "api",
        capabilities: ["web-ui"],
      }),
    );
    // api implies http-api; web-ui also required → only fullstack-capable templates
    const nest = result.templates.find((e) => e.templateId === "nest");
    assert.equal(nest?.compatible, false);
    assert.ok(nest?.reasons.some((r) => r.code === "capability-missing"));
  });

  it("scores architecture preference without invalidating compatibility", () => {
    const result = matchDiscovery(
      req({ projectType: "api", architectureLevel: "structured", backend: { runtime: "node" } }),
    );
    const nest = result.templates.find((e) => e.templateId === "nest");
    assert.ok(nest?.compatible);
    assert.ok(nest.reasons.some((r) => r.code === "architecture-match"));
    assert.ok((nest.score ?? 0) > 0);
  });

  it("returns no recommended template when nothing matches", () => {
    const result = matchDiscovery(
      req({
        projectType: "worker",
        frontend: { framework: "react" },
        backend: { runtime: "node" },
      }),
    );
    assert.equal(result.recommendedTemplateId, undefined);
    assert.ok(result.templates.every((entry) => !entry.compatible || entry.score >= 0));
    assert.ok(result.templates.every((entry) => !entry.compatible));
  });

  it("keeps weights summing to 100", () => {
    const templateTotal = Object.values(TEMPLATE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    const recipeTotal = Object.values(RECIPE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(templateTotal, 100);
    assert.equal(recipeTotal, 100);
  });
});

describe("recipe matching", () => {
  it("recommends relevant ORM recipes when database is required", () => {
    const result = matchDiscovery(
      req({
        projectType: "api",
        capabilities: ["database"],
        databases: ["postgresql"],
        backend: { runtime: "node" },
      }),
    );
    assert.ok(result.recommendedRecipeIds.length >= 1);
    assert.ok(
      result.recommendedRecipeIds.some((id) =>
        ["prisma", "drizzle-orm", "type-orm", "mikro-orm"].includes(id),
      ),
    );
    // exclusivity: only one ORM
    const orms = result.recommendedRecipeIds.filter((id) =>
      ["prisma", "drizzle-orm", "type-orm", "mikro-orm"].includes(id),
    );
    assert.equal(orms.length, 1);

    const prisma = result.recipes.find((e) => e.recipeId === "prisma");
    assert.ok(prisma?.relevant);
    assert.ok(prisma);
    assertScoreBounds(prisma.score);
  });

  it("marks tooling recipes irrelevant for a simple website", () => {
    const result = matchDiscovery(
      req({ projectType: "website", frontend: { framework: "react" } }),
    );
    assert.equal(result.recommendedRecipeIds.length, 0);
    const biome = result.recipes.find((e) => e.recipeId === "biome");
    assert.ok(biome);
    assert.equal(biome.relevant, false);
    assert.equal(biome.role, "irrelevant");
  });

  it("excludes recipes on scope mismatch", () => {
    const result = matchDiscovery(
      req({
        projectType: "api",
        scopes: ["server"],
        capabilities: ["database"],
      }),
    );
    const zustand = result.recipes.find((e) => e.recipeId === "zustand");
    assert.ok(zustand);
    assert.equal(zustand.compatible, false);
    assert.ok(
      zustand.reasons.some(
        (r) => r.code === "scope-mismatch" || r.code === "project-type-mismatch",
      ),
    );
  });

  it("excludes framework-mismatched UI recipes", () => {
    const result = matchDiscovery(
      req({
        projectType: "web-app",
        frontend: { framework: "vue" },
        capabilities: ["external-api"],
      }),
    );
    const mui = result.recipes.find((e) => e.recipeId === "mui");
    // mui is redundant/irrelevant for web-ui (template covers it) or framework mismatch
    assert.ok(mui);
    assert.ok(!mui.relevant || !mui.compatible);
  });

  it("respects selected recipe conflicts", () => {
    const result = matchDiscovery(
      req({
        projectType: "api",
        capabilities: ["database"],
        backend: { runtime: "node" },
      }),
      { selectedRecipeIds: ["prisma"] },
    );
    const drizzle = result.recipes.find((e) => e.recipeId === "drizzle-orm");
    assert.ok(drizzle);
    assert.equal(drizzle.compatible, false);
    assert.ok(drizzle.reasons.some((r) => r.code === "recipe-conflict"));
  });

  it("checks template overlay compatibility when templateId is provided", () => {
    const result = matchDiscovery(
      req({
        projectType: "api",
        capabilities: ["database"],
        backend: { runtime: "go" },
      }),
      { templateId: "stdlib-api" },
    );
    // Node ORM recipes have no Go overlays → incompatible with go template
    const prisma = result.recipes.find((e) => e.recipeId === "prisma");
    assert.ok(prisma);
    assert.equal(prisma.compatible, false);
    assert.ok(
      prisma.reasons.some((r) => r.code === "template-incompat" || r.code === "scope-mismatch"),
    );
  });

  it("does not recommend frontend recipes for workers", () => {
    const result = matchDiscovery(req({ projectType: "worker", backend: { runtime: "go" } }));
    assert.equal(result.recommendedTemplateId, "stdlib-worker");
    assert.equal(result.recommendedRecipeIds.length, 0);
    assert.ok(result.recipes.every((entry) => !entry.relevant || entry.role === "excluded"));
  });

  it("recommends fetchers when external-api is required", () => {
    const result = matchDiscovery(
      req({
        projectType: "web-app",
        frontend: { framework: "react" },
        capabilities: ["external-api"],
      }),
    );
    assert.ok(
      result.recommendedRecipeIds.some((id) => id === "kyjs" || id === "axios"),
      String(result.recommendedRecipeIds),
    );
    const fetcherExclusive = result.recommendedRecipeIds.filter((id) =>
      ["kyjs", "axios"].includes(id),
    );
    assert.equal(fetcherExclusive.length, 1);
  });

  it("handles empty registry queries without throwing", () => {
    const result = matchDiscovery(req({ projectType: "unknown" }));
    assert.ok(Array.isArray(result.templates));
    assert.ok(Array.isArray(result.recipes));
  });
});

describe("discovery general behavior", () => {
  it("never recommends incompatible templates", () => {
    const result = matchDiscovery(
      req({ projectType: "api", frontend: { framework: "react" }, capabilities: ["web-ui"] }),
    );
    if (result.recommendedTemplateId) {
      const pick = result.templates.find((e) => e.templateId === result.recommendedTemplateId);
      assert.ok(pick?.compatible);
    }
    for (const id of result.recommendedRecipeIds) {
      const recipe = result.recipes.find((e) => e.recipeId === id);
      assert.ok(recipe?.compatible && recipe.relevant);
    }
  });

  it("is deterministic for identical inputs", () => {
    const input = req({
      projectType: "fullstack",
      frontend: { framework: "react", mode: "ssr" },
      capabilities: ["database"],
      databases: ["postgresql"],
      architectureLevel: "balanced",
    });
    assert.deepEqual(matchDiscovery(input), matchDiscovery(input));
  });
});
