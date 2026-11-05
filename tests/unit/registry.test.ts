import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  UI_FRAMEWORKS,
  getRecipeCategories,
  getRecipeDir,
  getTemplateDir,
  getTemplateOverlayId,
  PACKAGE_ROOT,
  RECIPE_CATEGORIES,
  recipes,
  SCOPES,
  templates,
} from "@zealakit/core";

const RECIPE_MODULES_DIR = path.join(PACKAGE_ROOT, "packages/ecosystem-node/src/registry/recipes");
const NON_RECIPE_MODULES = new Set(["index.ts", "define.ts"]);

const familyKeys = new Set([
  ...Object.keys(templates),
  ...Object.keys(templates).map(getTemplateOverlayId),
]);

function assertAgentsSymlink(dir: string): void {
  if (!fs.existsSync(path.join(dir, ".agents"))) return;
  const cursor = path.join(dir, ".cursor");
  assert.ok(fs.lstatSync(cursor).isSymbolicLink(), `${cursor} must be a symlink`);
  assert.equal(fs.readlinkSync(cursor), ".agents", `${cursor} must point at .agents`);
}

describe("template registry", () => {
  for (const template of Object.values(templates)) {
    it(`template ${template.id} is well-formed`, () => {
      assert.ok((SCOPES as readonly string[]).includes(template.scope));
      if (template.uiFramework) {
        assert.ok((UI_FRAMEWORKS as readonly string[]).includes(template.uiFramework));
      }
      const dir = getTemplateDir(template.id);
      const ecosystem = template.ecosystem ?? "node";
      if (ecosystem === "go") {
        assert.ok(fs.existsSync(path.join(dir, "go.mod")), `go.mod missing for ${template.id}`);
      } else {
        assert.ok(
          fs.existsSync(path.join(dir, "package.json")),
          `package.json missing for ${template.id}`,
        );
      }
      assert.ok(
        fs.existsSync(path.join(dir, ".env.example")),
        `.env.example missing for ${template.id}`,
      );
      assertAgentsSymlink(dir);
    });
  }
});

describe("recipe registry", () => {
  it("has exactly one module per recipe named <id>.ts (monitor edits these files)", () => {
    const modules = fs
      .readdirSync(RECIPE_MODULES_DIR)
      .filter((file) => file.endsWith(".ts") && !NON_RECIPE_MODULES.has(file))
      .map((file) => file.replace(/\.ts$/, ""))
      .sort();
    assert.deepEqual(modules, Object.keys(recipes).sort());
  });

  for (const recipe of Object.values(recipes)) {
    it(`recipe ${recipe.id} is well-formed`, () => {
      assert.ok(fs.existsSync(getRecipeDir(recipe.id)), `recipes/${recipe.id}/ missing`);
      assertAgentsSymlink(getRecipeDir(recipe.id));

      for (const category of getRecipeCategories(recipe)) {
        assert.ok((RECIPE_CATEGORIES as readonly string[]).includes(category), category);
      }
      for (const framework of recipe.uiFrameworks ?? []) {
        assert.ok((UI_FRAMEWORKS as readonly string[]).includes(framework), framework);
      }

      const keyed = {
        fileTransforms: recipe.fileTransforms,
        overlayPackages: recipe.overlayPackages,
        overlayDevDependencies: recipe.overlayDevDependencies,
      };
      for (const [field, map] of Object.entries(keyed)) {
        for (const key of Object.keys(map ?? {})) {
          assert.ok(familyKeys.has(key), `${field}.${key} is not a template or overlay id`);
        }
      }
    });
  }
});
