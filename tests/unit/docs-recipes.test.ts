import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCS_PROFILE_FILE,
  docsLayoutForTemplate,
  docsSectionsForRecipes,
} from "@zealakit/core/ecosystem";
import {
  getRecipe,
  getRecipeCategories,
  getTemplate,
  RECIPE_CATEGORIES,
} from "@zealakit/core/internal";

import { scaffold } from "../helpers/scaffold.js";

type DocsProfile = {
  projectName: string;
  ecosystem: string;
  packageManager: string | null;
  units: Array<{ dir: string; name: string; layout: string }>;
  languages: string[];
  linkStyle: string;
  sections: string[];
  check: string | null;
};

describe("docs recipes", () => {
  for (const id of ["docs", "docs-go", "docs-python"]) {
    it(`${id} is a documentation recipe`, () => {
      const recipe = getRecipe(id);
      assert.ok(recipe, `${id} should be registered`);
      assert.deepEqual(getRecipeCategories(recipe), ["documentation"]);
      assert.ok((RECIPE_CATEGORIES as readonly string[]).includes("documentation"));
      assert.ok(!recipe.exclusive, "docs recipes coexist with storybook");
      assert.equal(recipe.supportedScopes, "all");
      assert.ok(recipe.finalize, "docs recipes fill profile.json in finalize");
    });
  }

  it("maps template scopes to layouts", () => {
    const layout = (id: string) => {
      const template = getTemplate(id);
      assert.ok(template);
      return docsLayoutForTemplate(template);
    };
    assert.equal(layout("vite-react"), "app");
    assert.equal(layout("next"), "app");
    assert.equal(layout("nest"), "service");
    assert.equal(layout("fastapi-api"), "service");
    assert.equal(layout("stdlib-worker"), "worker");
    assert.equal(layout("python-worker"), "worker");
  });

  it("derives recipe sections in layout order", () => {
    assert.deepEqual(docsSectionsForRecipes([]), []);
    assert.deepEqual(
      docsSectionsForRecipes(["github-actions", "vitest", "docker", "better-auth", "prisma"]),
      ["database", "docker", "authentication", "testing", "ci"],
    );
    assert.deepEqual(docsSectionsForRecipes(["goose"]), ["database"]);
    assert.deepEqual(docsSectionsForRecipes(["docker-python"]), ["docker"]);
  });

  it("writes a Node profile, checker and script", async () => {
    const app = await scaffold("vite-react", ["docs"]);
    assert.ok(app.exists(DOCS_PROFILE_FILE));
    assert.ok(app.exists("scripts/check-docs.mjs"));
    assert.ok(app.exists(".agents/skills/repo-docs/SKILL.md"));
    const profile = app.json<DocsProfile>(DOCS_PROFILE_FILE);
    assert.equal(profile.ecosystem, "node");
    assert.equal(profile.packageManager, "npm");
    assert.equal(profile.units[0]?.layout, "app");
    assert.equal(profile.units[0]?.name, profile.projectName);
    assert.deepEqual(profile.languages, ["en"]);
    assert.equal(profile.linkStyle, "relative");
    assert.deepEqual(profile.sections, []);
    assert.equal(profile.check, "npm run docs:check");
    assert.equal(app.pkg().scripts?.["docs:check"], "node scripts/check-docs.mjs");
    assert.ok(app.read("AGENTS.md").includes(".agents/skills/repo-docs/SKILL.md"));
    assert.ok(app.read("CLAUDE.md").includes(".agents/skills/repo-docs/SKILL.md"));
  });

  it("adds sections from the selected recipes", async () => {
    const app = await scaffold("next", ["docs", "prisma", "docker", "vitest", "github-actions"]);
    const profile = app.json<DocsProfile>(DOCS_PROFILE_FILE);
    assert.deepEqual(profile.sections, ["database", "docker", "testing", "ci"]);
  });

  it("writes Go and Python profiles without a Node checker script", async () => {
    const go = await scaffold("stdlib-api", ["docs-go"]);
    const goProfile = go.json<DocsProfile>(DOCS_PROFILE_FILE);
    assert.equal(goProfile.ecosystem, "go");
    assert.equal(goProfile.packageManager, null);
    assert.equal(goProfile.units[0]?.layout, "service");
    assert.equal(goProfile.check, null);
    assert.ok(!go.exists("scripts/check-docs.mjs"));

    const worker = await scaffold("stdlib-worker", ["docs-go"]);
    assert.equal(worker.json<DocsProfile>(DOCS_PROFILE_FILE).units[0]?.layout, "worker");

    const python = await scaffold("fastapi-api", ["docs-python"]);
    const pythonProfile = python.json<DocsProfile>(DOCS_PROFILE_FILE);
    assert.equal(pythonProfile.ecosystem, "python");
    assert.equal(pythonProfile.units[0]?.layout, "service");
    assert.equal(pythonProfile.check, null);
  });
});
