import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  getAllRecipes,
  getAllTemplateIds,
  getRecipe,
  getRecipeTransforms,
  getTemplate,
  getTemplateOverlayId,
  isRecipeCompatible,
  type RecipeConfig,
  resolveRecipeDependencies,
  transformSource,
  validateRecipeConflicts,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import { listRecipeFiles, listTemplateFiles } from "../../packages/core/src/scaffold/inventory.js";

/**
 * Static compatibility matrix for recipe file transforms. Every template ×
 * recipe (and every pair of non-conflicting recipes) is simulated in memory —
 * template files, recipe layers, then transforms in apply order — so template
 * drift surfaces here instead of as a `transform did not match` for end users.
 */

type Source = { absolutePath: string };

const templateFilesCache = new Map<string, Map<string, Source>>();
const recipeFilesCache = new Map<string, Map<string, Source>>();
const textCache = new Map<string, string>();

function readText(absolutePath: string): string {
  let text = textCache.get(absolutePath);
  if (text === undefined) {
    text = fs.readFileSync(absolutePath, "utf-8");
    textCache.set(absolutePath, text);
  }
  return text;
}

function templateFiles(templateId: string): Map<string, Source> {
  let files = templateFilesCache.get(templateId);
  if (!files) {
    files = listTemplateFiles(templateId);
    templateFilesCache.set(templateId, files);
  }
  return files;
}

function recipeFiles(recipeId: string, templateId: string): Map<string, Source> {
  const key = `${templateId}:${recipeId}`;
  let files = recipeFilesCache.get(key);
  if (!files) {
    const template = getTemplate(templateId);
    if (!template) throw new Error(`unknown template ${templateId}`);
    files = listRecipeFiles(recipeId, templateId, template);
    recipeFilesCache.set(key, files);
  }
  return files;
}

/** Returns the transform errors for applying `recipeIds` (defaults + deps included) to a template. */
function simulate(templateId: string, recipeIds: string[]): string[] {
  const template = getTemplate(templateId);
  if (!template) return [`unknown template ${templateId}`];
  const resolved = resolveRecipeDependencies(withDefaultRecipes(template.scope, recipeIds));
  if (!resolved.ok) return [`dependency resolution failed for ${recipeIds.join(",")}`];

  const files = new Map<string, Source>(templateFiles(templateId));
  const edited = new Map<string, string>();
  const errors: string[] = [];

  for (const id of resolved.recipeIds) {
    for (const [relative, source] of recipeFiles(id, templateId)) {
      files.set(relative, source);
      edited.delete(relative);
    }
    const recipe = getRecipe(id) as RecipeConfig;
    for (const transform of getRecipeTransforms(recipe, templateId)) {
      const current =
        edited.get(transform.file) ??
        (files.has(transform.file)
          ? readText((files.get(transform.file) as Source).absolutePath)
          : undefined);
      if (current === undefined) {
        errors.push(`${templateId} + ${id}: transform target not found: ${transform.file}`);
        continue;
      }
      try {
        edited.set(transform.file, transformSource(id, transform, current));
      } catch (error) {
        errors.push(`${templateId} + ${id}: ${(error as Error).message}`);
      }
    }
  }
  return errors;
}

describe("recipe transform keys", () => {
  it("only target known template ids or overlay ids", () => {
    const known = new Set<string>();
    for (const id of getAllTemplateIds()) {
      known.add(id);
      known.add(getTemplateOverlayId(id));
    }
    const unknown: string[] = [];
    for (const recipe of getAllRecipes()) {
      for (const key of Object.keys(recipe.fileTransforms ?? {})) {
        if (!known.has(key)) unknown.push(`${recipe.id}: '${key}'`);
      }
    }
    assert.deepEqual(unknown, []);
  });
});

for (const templateId of getAllTemplateIds()) {
  const template = getTemplate(templateId);
  if (!template || (template.ecosystem ?? "node") === "go") continue;

  const candidates = getAllRecipes().filter(
    (recipe) => !recipe.default && isRecipeCompatible(recipe, template),
  );

  describe(`transform matrix: ${templateId}`, () => {
    it("applies every compatible recipe on its own", () => {
      const errors = candidates.flatMap((recipe) => simulate(templateId, [recipe.id]));
      assert.deepEqual(errors, []);
    });

    it("applies every pair of non-conflicting recipes", () => {
      const touches = (recipe: RecipeConfig): boolean =>
        getRecipeTransforms(recipe, templateId).length > 0;
      const errors: string[] = [];
      for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
          const a = candidates[i] as RecipeConfig;
          const b = candidates[j] as RecipeConfig;
          if (!touches(a) && !touches(b)) continue;
          if (!validateRecipeConflicts([a.id, b.id]).valid) continue;
          errors.push(...simulate(templateId, [a.id, b.id]));
        }
      }
      assert.deepEqual([...new Set(errors)], []);
    });
  });
}
