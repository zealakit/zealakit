import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ECOSYSTEMS,
  getEcosystemMetadata,
  getInfo,
  getProjectTypeMetadata,
  getRecipe,
  getRecipeCategoryMetadata,
  getRecipeIds,
  getRecipeMetadata,
  getScopeMetadata,
  getTemplateIds,
  getTemplateMetadata,
  getUiFrameworkMetadata,
  INFO_SCHEMA_VERSION,
  normalizeInfoFilter,
  PACKAGE_ROOT,
  PROJECT_TYPES,
  queryMetadata,
  RECIPE_CATEGORIES,
  recipeSupportsScope,
  recipes,
  resolveRecipeProfile,
  resolveTemplateProfile,
  SCOPES,
  templates,
  UI_FRAMEWORKS,
  withDefaultRecipes,
} from "@zealakit/core";

describe("metadata retrieval", () => {
  it("lists every registered template and recipe in registry order", () => {
    assert.deepEqual(getTemplateIds(), Object.keys(templates));
    assert.deepEqual(getRecipeIds(), Object.keys(recipes));
    assert.deepEqual(
      getTemplateMetadata().map((template) => template.id),
      Object.keys(templates),
    );
    assert.deepEqual(
      getRecipeMetadata().map((recipe) => recipe.id),
      Object.keys(recipes),
    );
  });

  it("exposes every ecosystem, scope, project type, framework and category", () => {
    assert.deepEqual(
      getEcosystemMetadata().map((ecosystem) => ecosystem.id),
      [...ECOSYSTEMS],
    );
    assert.deepEqual(
      getScopeMetadata().map((scope) => scope.id),
      [...SCOPES],
    );
    assert.deepEqual(
      getProjectTypeMetadata().map((projectType) => projectType.id),
      [...PROJECT_TYPES],
    );
    assert.deepEqual(
      getUiFrameworkMetadata().map((framework) => framework.id),
      [...UI_FRAMEWORKS],
    );
    assert.deepEqual(
      getRecipeCategoryMetadata().map((category) => category.id),
      [...RECIPE_CATEGORIES],
    );
  });

  it("normalizes templates: defaults, compatibility and prompt steps", () => {
    for (const template of getTemplateMetadata()) {
      assert.equal(template.ecosystem, template.path.split("/")[0]);
      assert.deepEqual(
        template.defaultRecipes,
        withDefaultRecipes(template.scope, []),
        template.id,
      );
      for (const step of template.promptSteps) {
        assert.ok(step.options.length > 0);
        for (const option of step.options) {
          assert.ok(template.compatibleRecipes.includes(option), `${template.id}: ${option}`);
        }
      }
    }
  });

  it("normalizes recipes: ecosystem, sorted dependency maps, agent entry", () => {
    const recipesMetadata = getRecipeMetadata();
    const biome = recipesMetadata.find((recipe) => recipe.id === "biome");
    assert.equal(biome?.ecosystem, "node");
    assert.equal(biome?.hasAgentEntry, false);
    assert.deepEqual(biome?.packages, {});

    const shadcn = recipesMetadata.find((recipe) => recipe.id === "shadcn-ui");
    assert.equal(shadcn?.hasAgentEntry, true);
    const packageNames = Object.keys(shadcn?.packages ?? {});
    assert.ok(packageNames.length > 0);
    assert.deepEqual(packageNames, [...packageNames].sort());
    assert.ok((shadcn?.templates.length ?? 0) > 0);
    assert.deepEqual(Object.keys(shadcn?.overlayPackages ?? {}), [
      ...Object.keys(shadcn?.overlayPackages ?? {}).sort(),
    ]);
  });

  it("exposes Discovery profiles only when requested", () => {
    const plain = getInfo();
    assert.ok(plain.data.templates.every((template) => template.discovery === undefined));

    const discovery = getInfo({ discovery: true });
    assert.equal(discovery.filters.discovery, true);
    for (const template of discovery.data.templates) {
      assert.deepEqual(template.discovery, resolveTemplateProfile(template.id));
    }
    for (const recipe of discovery.data.recipes) {
      assert.deepEqual(recipe.discovery, resolveRecipeProfile(recipe.id));
    }
  });

  it("does not expose mutable registry objects", () => {
    const info = getInfo({ discovery: true });
    const template = info.data.templates[0];
    assert.ok(template);
    template.discovery?.capabilities.push("database");
    template.compatibleRecipes.push("__mutated__");

    const recipe = info.data.recipes[0];
    assert.ok(recipe);
    recipe.packages.__mutated__ = "0.0.0";
    recipe.discovery?.conflicts.push("__mutated__");

    assert.ok(!resolveTemplateProfile(template.id)?.capabilities.includes("database"));
    assert.deepEqual(getRecipe(recipe.id)?.packages, {});
    assert.ok(!resolveRecipeProfile(recipe.id)?.conflicts.includes("__mutated__"));
  });
});

describe("metadata filtering", () => {
  it("filters by ecosystem", () => {
    const info = getInfo({ ecosystem: "go" });
    assert.ok(info.data.templates.length > 0);
    assert.ok(info.data.templates.every((template) => template.ecosystem === "go"));
    assert.deepEqual(info.data.recipes, []);
    assert.deepEqual(
      info.data.ecosystems.map((ecosystem) => ecosystem.id),
      ["go"],
    );
  });

  it("filters by scope", () => {
    const info = getInfo({ scope: "server" });
    const visible = new Set(info.data.recipes.map((recipe) => recipe.id));
    assert.ok(info.data.templates.every((template) => template.scope === "server"));
    for (const recipe of info.data.recipes) {
      const config = getRecipe(recipe.id);
      assert.ok(config);
      assert.ok(recipeSupportsScope(config, "server"));
      assert.ok(
        recipe.templates.every((templateId) =>
          info.data.templates.some((t) => t.id === templateId),
        ),
      );
    }
    for (const template of info.data.templates) {
      assert.ok(template.compatibleRecipes.every((id) => visible.has(id)));
    }
  });

  it("filters by template id and keeps relation ids inside the visible set", () => {
    const info = getInfo({ templateId: "nest" });
    assert.deepEqual(
      info.data.templates.map((template) => template.id),
      ["nest"],
    );
    assert.ok(info.data.recipes.length > 0);
    for (const recipe of info.data.recipes) {
      assert.deepEqual(recipe.templates, ["nest"]);
      assert.deepEqual(recipe.incompatibleTemplates, []);
    }
  });

  it("filters by recipe id", () => {
    const info = getInfo({ recipeId: "biome" });
    assert.deepEqual(
      info.data.recipes.map((recipe) => recipe.id),
      ["biome"],
    );
    assert.ok(info.data.templates.length > 0);
    for (const template of info.data.templates) {
      assert.deepEqual(template.compatibleRecipes, ["biome"]);
    }
    assert.deepEqual(info.data.categories.find((category) => category.id === "linter")?.recipes, [
      "biome",
    ]);
  });

  it("filters by recipe category", () => {
    const info = getInfo({ category: "orm" });
    assert.ok(info.data.recipes.length > 0);
    assert.ok(info.data.recipes.every((recipe) => recipe.categories.includes("orm")));
    assert.ok(info.data.templates.every((template) => template.compatibleRecipes.length > 0));
    assert.deepEqual(
      info.data.categories.map((category) => category.id),
      ["orm"],
    );
  });

  it("filters by project type using Discovery profiles", () => {
    const info = getInfo({ projectType: "server-api" });
    for (const template of info.data.templates) {
      assert.ok(resolveTemplateProfile(template.id)?.projectTypes.includes("server-api"));
    }
    for (const recipe of info.data.recipes) {
      const profile = resolveRecipeProfile(recipe.id);
      assert.ok(!profile?.projectTypes || profile.projectTypes.includes("server-api"));
    }
  });

  it("returns empty sections for unsupported project types", () => {
    const info = getInfo({ projectType: "complete-product" });
    assert.deepEqual(info.data.templates, []);
    assert.deepEqual(info.data.recipes, []);
  });

  it("filters by UI framework", () => {
    const info = getInfo({ uiFramework: "vue" });
    assert.ok(info.data.templates.length > 0);
    assert.ok(info.data.templates.every((template) => template.uiFramework === "vue"));
    for (const recipe of info.data.recipes) {
      assert.ok(recipe.uiFrameworks === null || recipe.uiFrameworks.includes("vue"));
    }
  });

  it("combines filters with AND semantics", () => {
    const info = getInfo({
      ecosystem: "node",
      scope: "server",
      projectType: "server-api",
      category: "orm",
      discovery: true,
    });
    assert.ok(info.data.templates.length > 0);
    assert.ok(info.data.recipes.length > 0);
    assert.ok(info.data.templates.every((template) => template.discovery !== undefined));
    for (const recipe of info.data.recipes) {
      assert.ok(recipe.categories.includes("orm"));
      assert.ok(recipe.supportedScopes === "all" || recipe.supportedScopes.includes("server"));
    }
  });

  it("returns empty results instead of failing for contradictory filters", () => {
    const info = getInfo({ ecosystem: "go", recipeId: "biome" });
    assert.deepEqual(info.data.templates, []);
    assert.deepEqual(info.data.recipes, []);
    assert.ok(info.data.categories.every((category) => category.recipes.length === 0));
    assert.deepEqual(info.filters, { ecosystem: "go", recipeId: "biome" });
  });

  it("is deterministic across calls", () => {
    assert.equal(JSON.stringify(getInfo()), JSON.stringify(getInfo()));
    assert.equal(
      JSON.stringify(getInfo({ scope: "server", discovery: true })),
      JSON.stringify(getInfo({ scope: "server", discovery: true })),
    );
    assert.equal(JSON.stringify(getRecipeMetadata()), JSON.stringify(getRecipeMetadata()));
  });
});

describe("filter validation", () => {
  it("accepts known values and returns a typed filter", () => {
    const result = normalizeInfoFilter({
      ecosystem: "node",
      scope: "server",
      projectType: "server-api",
      uiFramework: "react",
      templateId: "nest",
      recipeId: "biome",
      category: "linter",
      discovery: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.filter, {
      ecosystem: "node",
      scope: "server",
      projectType: "server-api",
      uiFramework: "react",
      templateId: "nest",
      recipeId: "biome",
      category: "linter",
      discovery: true,
    });
  });

  it("reports every invalid value instead of ignoring it", () => {
    const result = normalizeInfoFilter({
      ecosystem: "deno",
      scope: "desktop",
      projectType: "complete",
      uiFramework: "sveltekit",
      templateId: "nope",
      recipeId: "nope",
      category: "magic",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.length, 7);
  });

  it("treats discovery=false as a no-op", () => {
    const result = normalizeInfoFilter({ discovery: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.filter, {});
  });

  it("orders echoed filters deterministically", () => {
    const info = getInfo({ discovery: true, recipeId: "biome", ecosystem: "node" });
    assert.deepEqual(Object.keys(info.filters), ["ecosystem", "recipeId", "discovery"]);
    assert.equal(info.schemaVersion, INFO_SCHEMA_VERSION);
    assert.equal(info.command, "info");
  });
});

describe("raw metadata queries", () => {
  it("normalizes string filters and returns metadata with the applied filter", () => {
    const result = queryMetadata({
      ecosystem: "node",
      scope: "server",
      recipeId: "biome",
      discovery: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.filter, {
      ecosystem: "node",
      scope: "server",
      recipeId: "biome",
      discovery: true,
    });
    assert.deepEqual(
      result.data.templates.map((template) => template.id),
      getTemplateMetadata(result.filter).map((template) => template.id),
    );
    assert.ok(result.data.templates.every((template) => template.discovery !== undefined));
    assert.ok(result.data.recipes.every((recipe) => recipe.discovery !== undefined));
  });

  it("reports every invalid filter value", () => {
    const result = queryMetadata({ ecosystem: "deno", templateId: "nope" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.some((error) => /deno/.test(error)));
    assert.ok(result.errors.some((error) => /nope/.test(error)));
  });

  it("distinguishes unknown ids (empty) from invalid input (errors)", () => {
    assert.deepEqual(getTemplateMetadata({ templateId: "nope" }), []);
    assert.deepEqual(getRecipeMetadata({ recipeId: "nope" }), []);
    assert.equal(queryMetadata({ templateId: "nope" }).ok, false);
  });
});

describe("Discovery metadata retrieval", () => {
  it("attaches resolved profiles only when requested", () => {
    for (const template of getTemplateMetadata({ discovery: true })) {
      assert.deepEqual(template.discovery, resolveTemplateProfile(template.id));
    }
    for (const recipe of getRecipeMetadata({ discovery: true })) {
      assert.deepEqual(recipe.discovery, resolveRecipeProfile(recipe.id));
    }
    assert.ok(getTemplateMetadata().every((template) => template.discovery === undefined));
    assert.ok(getRecipeMetadata().every((recipe) => recipe.discovery === undefined));
  });

  it("supports ecosystem-scoped discovery metadata", () => {
    const goTemplates = getTemplateMetadata({ ecosystem: "go", discovery: true });
    assert.ok(goTemplates.length > 0);
    assert.ok(goTemplates.every((template) => template.ecosystem === "go"));
    assert.ok(goTemplates.every((template) => template.discovery !== undefined));
    assert.deepEqual(getRecipeMetadata({ ecosystem: "go" }), []);
  });
});

describe("serialization and architecture", () => {
  it("returns JSON-serializable metadata without runtime-only values", () => {
    const info = getInfo({ discovery: true });
    const serialized = JSON.parse(JSON.stringify(info));
    // Optional undefined fields disappear in JSON; the serialized form must be stable.
    assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);

    const containsFunction = (value: unknown): boolean => {
      if (typeof value === "function") return true;
      if (Array.isArray(value)) return value.some(containsFunction);
      if (value !== null && typeof value === "object") {
        return Object.values(value).some(containsFunction);
      }
      return false;
    };
    assert.equal(containsFunction(info), false);
  });

  it("keeps core independent from ecosystem packages", () => {
    const sourceRoot = path.join(PACKAGE_ROOT, "packages/core/src");
    const offenders: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".ts")) continue;
        const source = fs.readFileSync(fullPath, "utf-8");
        if (/from\s+["']@zealakit\/ecosystem/.test(source)) {
          offenders.push(path.relative(PACKAGE_ROOT, fullPath));
        }
      }
    };
    visit(sourceRoot);
    assert.deepEqual(offenders, []);
  });

  it("keeps registry ids as the single source of truth", () => {
    assert.deepEqual(
      getTemplateMetadata().map((template) => template.id),
      Object.keys(templates),
    );
    assert.deepEqual(
      getRecipeMetadata().map((recipe) => recipe.id),
      Object.keys(recipes),
    );
  });
});
