import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchDiscovery, type ProjectRequirements, TEMPLATE_SCORE_WEIGHTS } from "@zealakit/core";

type ReqInput =
  | (Omit<Extract<ProjectRequirements, { projectType: "ui" }>, "scopes" | "capabilities"> & {
      scopes?: ProjectRequirements["scopes"];
      capabilities?: ProjectRequirements["capabilities"];
    })
  | (Omit<
      Extract<ProjectRequirements, { projectType: "server-api" }>,
      "scopes" | "capabilities"
    > & {
      scopes?: ProjectRequirements["scopes"];
      capabilities?: ProjectRequirements["capabilities"];
    })
  | (Omit<
      Extract<ProjectRequirements, { projectType: "background-worker" }>,
      "scopes" | "capabilities"
    > & {
      scopes?: ProjectRequirements["scopes"];
      capabilities?: ProjectRequirements["capabilities"];
    });

function req(partial: ReqInput): ProjectRequirements {
  return {
    ...partial,
    scopes: partial.scopes ?? [],
    capabilities: partial.capabilities ?? [],
  } as ProjectRequirements;
}

function compatibleIds(requirements: ProjectRequirements): string[] {
  return matchDiscovery(requirements)
    .templates.filter((entry) => entry.compatible)
    .map((entry) => entry.templateId);
}

describe("template matching (branching project types)", () => {
  it("ranks exact project type matches and prefers simpler templates on ties", () => {
    const first = matchDiscovery(req({ projectType: "ui" }));
    const second = matchDiscovery(req({ projectType: "ui" }));
    assert.deepEqual(
      first.templates.map((entry) => [entry.templateId, entry.score, entry.compatible]),
      second.templates.map((entry) => [entry.templateId, entry.score, entry.compatible]),
    );
    assert.ok(first.recommendedTemplateId);
    assert.ok(compatibleIds(req({ projectType: "ui" })).includes("vite-react"));
  });

  it("UI never recommends backend-only templates", () => {
    const ids = compatibleIds(req({ projectType: "ui" }));
    assert.ok(!ids.includes("nest"));
    assert.ok(!ids.includes("hono"));
    assert.ok(!ids.includes("gin-api"));
    assert.ok(!ids.includes("stdlib-worker"));
  });

  it("Server/API never recommends frontend-only templates", () => {
    const ids = compatibleIds(req({ projectType: "server-api" }));
    assert.ok(!ids.includes("vite-react"));
    assert.ok(!ids.includes("vite-vue"));
    assert.ok(!ids.includes("astro-react-client"));
    assert.ok(ids.includes("nest") || ids.includes("hono"));
  });

  it("Worker never recommends API-only templates", () => {
    const ids = compatibleIds(req({ projectType: "background-worker" }));
    assert.ok(!ids.includes("nest"));
    assert.ok(!ids.includes("gin-api"));
    assert.ok(!ids.includes("vite-react"));
    assert.deepEqual(ids, ["stdlib-worker"]);
  });

  it("UI with external API does not require a backend template", () => {
    const result = matchDiscovery(
      req({ projectType: "ui", externalApi: true, frontend: { framework: "react", mode: "spa" } }),
    );
    assert.ok(compatibleIds(req({ projectType: "ui", externalApi: true })).includes("vite-react"));
    assert.ok(result.recommendedRecipeIds.some((id) => id === "kyjs" || id === "axios"));
  });

  it("UI with database requirements does not recommend frontend-only templates", () => {
    const ids = compatibleIds(
      req({ projectType: "ui", capabilities: ["database"], frontend: { framework: "react" } }),
    );
    assert.ok(!ids.includes("vite-react"));
    assert.ok(!ids.includes("vite-vue"));
    assert.ok(!ids.includes("astro-react-client"));
    assert.ok(ids.every((id) => ["next", "astro-react-hybrid"].includes(id)));
  });

  it("Server/API with database recommends only compatible configurations", () => {
    const result = matchDiscovery(
      req({
        projectType: "server-api",
        capabilities: ["database"],
        databases: ["postgresql"],
        backend: { runtime: "node" },
      }),
    );
    assert.ok(result.recommendedTemplateId === "nest" || result.recommendedTemplateId === "hono");
    assert.ok(
      result.recommendedRecipeIds.some(
        (id) => id === "prisma" || id.includes("orm") || id === "drizzle-orm",
      ),
    );
  });

  it("respects explicit runtime and framework preferences", () => {
    const vue = compatibleIds(req({ projectType: "ui", frontend: { framework: "vue" } }));
    assert.ok(vue.every((id) => id === "vite-vue" || id === "nuxt"));

    const gin = matchDiscovery(
      req({ projectType: "server-api", backend: { runtime: "go", framework: "gin" } }),
    );
    assert.equal(gin.recommendedTemplateId, "gin-api");
  });

  it("unsupported requirements produce clear explanations", () => {
    const svelte = matchDiscovery(req({ projectType: "ui", frontend: { framework: "svelte" } }));
    assert.equal(svelte.recommendedTemplateId, undefined);
    assert.ok(svelte.templates.every((entry) => !entry.compatible));

    const graphql = matchDiscovery(req({ projectType: "server-api", serviceType: "graphql" }));
    assert.equal(graphql.recommendedTemplateId, undefined);

    const tsWorker = matchDiscovery(
      req({ projectType: "background-worker", backend: { runtime: "node" } }),
    );
    assert.equal(tsWorker.recommendedTemplateId, undefined);
  });

  it("does not treat missing optional preferences as hard constraints", () => {
    const withPrefs = matchDiscovery(
      req({ projectType: "server-api", backend: { runtime: "node" } }),
    );
    const withoutPrefs = matchDiscovery(req({ projectType: "server-api" }));
    assert.ok(withPrefs.recommendedTemplateId);
    assert.ok(withoutPrefs.recommendedTemplateId);
    assert.ok(compatibleIds(req({ projectType: "server-api" })).length >= 2);
  });

  it("keeps weights summing to 100", () => {
    const sum = Object.values(TEMPLATE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(sum, 100);
  });

  it("is deterministic for identical inputs", () => {
    const input = req({
      projectType: "ui",
      frontend: { framework: "react", mode: "spa" },
    });
    const a = matchDiscovery(input);
    const b = matchDiscovery(input);
    assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  });
});

describe("recipe matching", () => {
  it("recommends relevant ORM recipes when database is required", () => {
    const input = req({
      projectType: "server-api",
      capabilities: ["database"],
      databases: ["postgresql"],
      backend: { runtime: "node" },
    });
    const templates = matchDiscovery(input);
    assert.ok(templates.recommendedTemplateId);
    const result = matchDiscovery(input, { templateId: templates.recommendedTemplateId });
    assert.ok(result.recommendedRecipeIds.length >= 1);
  });

  it("recommends exactly one exclusive linter for a simple UI", () => {
    const input = req({ projectType: "ui", frontend: { framework: "react" } });
    const templates = matchDiscovery(input);
    const result = matchDiscovery(input, { templateId: templates.recommendedTemplateId });
    const linters = result.recommendedRecipeIds.filter((id) => id === "biome" || id === "eslint");
    assert.deepEqual(linters, ["biome"]);
    assert.equal(result.recipes.find((entry) => entry.recipeId === "eslint")?.role, "excluded");
  });

  it("recommends fetchers when external API is required on UI", () => {
    const input = req({ projectType: "ui", externalApi: true });
    const templates = matchDiscovery(input);
    const result = matchDiscovery(input, { templateId: templates.recommendedTemplateId });
    assert.ok(result.recommendedRecipeIds.some((id) => id === "kyjs" || id === "axios"));
  });
});
