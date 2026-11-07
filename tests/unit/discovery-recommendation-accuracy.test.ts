import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchDiscovery,
  normalizeDiscoveryAnswers,
  type ProjectRequirements,
  type RecipeMatchResult,
} from "@zealakit/core";
import {
  buildRecipeChoices,
  defaultSelectedRecipeIds,
} from "../../apps/cli/src/discovery/present.js";

const ORM_IDS = ["type-orm", "mikro-orm", "drizzle-orm", "prisma"] as const;
const LINTER_IDS = ["biome", "eslint"] as const;

function serverWithDatabase(): ProjectRequirements {
  return {
    projectType: "server-api",
    scopes: [],
    capabilities: ["database"],
    databases: ["postgresql"],
    backend: { runtime: "node" },
  };
}

function uiWithServerData(): ProjectRequirements {
  return {
    projectType: "ui",
    scopes: [],
    capabilities: ["database"],
  };
}

function simpleUi(): ProjectRequirements {
  return {
    projectType: "ui",
    scopes: [],
    capabilities: [],
    frontend: { framework: "react" },
  };
}

function recipeEntry(
  result: ReturnType<typeof matchDiscovery>,
  recipeId: string,
): RecipeMatchResult | undefined {
  return result.recipes.find((entry) => entry.recipeId === recipeId);
}

function recommendedOrmIds(result: ReturnType<typeof matchDiscovery>): string[] {
  return result.recommendedRecipeIds.filter((id) => (ORM_IDS as readonly string[]).includes(id));
}

describe("ORM applicability", () => {
  it("recommends an ORM for server API projects with structured storage", () => {
    const result = matchDiscovery(serverWithDatabase(), { templateId: "nest" });
    assert.equal(recommendedOrmIds(result).length, 1);
    for (const ormId of ORM_IDS) {
      assert.equal(recipeEntry(result, ormId)?.compatible, true, ormId);
    }
  });

  it("offers ORM recipes for hybrid templates with server data", () => {
    for (const templateId of ["next", "nuxt", "astro-react-hybrid"]) {
      const result = matchDiscovery(uiWithServerData(), { templateId });
      assert.equal(recommendedOrmIds(result).length, 1, templateId);
      for (const ormId of ORM_IDS) {
        assert.equal(recipeEntry(result, ormId)?.compatible, true, `${templateId}:${ormId}`);
      }
    }
  });

  it("keeps ORM recipes incompatible with client-only templates", () => {
    for (const templateId of ["vite-react", "vite-vue", "astro-react-client"]) {
      const result = matchDiscovery(uiWithServerData(), { templateId });
      assert.deepEqual(recommendedOrmIds(result), [], templateId);
      for (const ormId of ORM_IDS) {
        assert.equal(recipeEntry(result, ormId)?.compatible, false, `${templateId}:${ormId}`);
      }
    }
  });

  it("keeps ORM recipes incompatible with Go API templates", () => {
    const requirements: ProjectRequirements = {
      projectType: "server-api",
      scopes: [],
      capabilities: ["database"],
      databases: ["postgresql"],
    };
    const result = matchDiscovery(requirements, { templateId: "gin-api" });
    assert.deepEqual(recommendedOrmIds(result), []);
    for (const ormId of ORM_IDS) {
      assert.equal(recipeEntry(result, ormId)?.compatible, false, ormId);
    }
  });

  it("does not treat ORM as relevant when the project has no database need", () => {
    const result = matchDiscovery(simpleUi(), { templateId: "next" });
    assert.deepEqual(recommendedOrmIds(result), []);
    for (const ormId of ORM_IDS) {
      assert.equal(recipeEntry(result, ormId)?.relevant, false, ormId);
    }
  });
});

describe("linter relevance", () => {
  it("recommends exactly one exclusive linter for server templates", () => {
    const result = matchDiscovery(
      { projectType: "server-api", scopes: [], capabilities: [] },
      { templateId: "hono" },
    );
    const linters = result.recommendedRecipeIds.filter((id) =>
      (LINTER_IDS as readonly string[]).includes(id),
    );
    assert.deepEqual(linters, ["biome"]);
    assert.equal(recipeEntry(result, "eslint")?.role, "excluded");
  });

  it("recommends exactly one exclusive linter for hybrid and client templates", () => {
    for (const [requirements, templateId] of [
      [uiWithServerData(), "next"],
      [simpleUi(), "vite-react"],
    ] as const) {
      const result = matchDiscovery(requirements, { templateId });
      const linters = result.recommendedRecipeIds.filter((id) =>
        (LINTER_IDS as readonly string[]).includes(id),
      );
      assert.deepEqual(linters, ["biome"], templateId);
      assert.ok(buildRecipeChoices(result).some((choice) => choice.value === "biome"));
    }
  });

  it("never recommends a linter that is incompatible with the template", () => {
    const result = matchDiscovery(
      { projectType: "server-api", scopes: [], capabilities: [] },
      { templateId: "gin-api" },
    );
    assert.deepEqual(result.recommendedRecipeIds, []);
    for (const linterId of LINTER_IDS) {
      assert.equal(recipeEntry(result, linterId)?.compatible, false, linterId);
    }
  });

  it("keeps the other linter available as an alternative", () => {
    const result = matchDiscovery(simpleUi(), { templateId: "vite-react" });
    const choices = buildRecipeChoices(result);
    assert.ok(choices.some((choice) => choice.value === "biome"));
    const eslint = choices.find((choice) => choice.value === "eslint");
    assert.ok(eslint);
    assert.match(eslint.hint ?? "", /alternative/);
  });
});

describe("optional non-exclusive recipes", () => {
  it("offers Storybook for UI work without pre-selecting it", () => {
    const requirements: ProjectRequirements = {
      projectType: "ui",
      scopes: [],
      capabilities: [],
      frontend: { framework: "react" },
      recipeInterests: ["ui"],
    };
    const result = matchDiscovery(requirements, { templateId: "next" });
    const storybook = recipeEntry(result, "storybook");
    assert.ok(storybook);
    assert.equal(storybook.compatible, true);
    assert.equal(storybook.relevant, true);
    assert.ok(!result.recommendedRecipeIds.includes("storybook"));
    assert.ok(!defaultSelectedRecipeIds(result).includes("storybook"));
  });

  it("keeps Storybook manually selectable from the recipe list", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "ui",
      uiTechPreference: "react",
      websiteKind: "online-store",
      visitorActions: ["browse-catalog"],
    });
    assert.ok(normalized.ok);
    if (!normalized.ok) return;

    const templates = matchDiscovery(normalized.requirements);
    assert.ok(templates.recommendedTemplateId);
    const result = matchDiscovery(normalized.requirements, {
      templateId: templates.recommendedTemplateId,
    });

    const choice = buildRecipeChoices(result).find((entry) => entry.value === "storybook");
    assert.ok(choice, "Storybook should stay visible in the multiselect");
    assert.match(choice.hint ?? "", /optional/);
    assert.ok(!defaultSelectedRecipeIds(result).includes("storybook"));
    assert.ok(result.recommendedRecipeIds.includes("biome"));
  });

  it("does not pre-select categories without a matching requirement", () => {
    const result = matchDiscovery(simpleUi(), { templateId: "vite-react" });
    assert.ok(!result.recommendedRecipeIds.includes("storybook"));
    assert.ok(!result.recommendedRecipeIds.includes("client-shared-pieces"));
  });
});
