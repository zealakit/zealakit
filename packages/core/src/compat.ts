import {
  getRecipe,
  getRecipeCategories,
  getRecipesByCategory,
  recipeSupportsScope,
} from "./registry/index.js";
import { resolveRecipeOverlay } from "./scaffold/paths.js";
import type { RecipeCategory, RecipeConfig, TemplateConfig } from "./types.js";

export type IncompatibilityCode = "scope" | "ui-framework" | "overlay";

export type Incompatibility = { code: IncompatibilityCode; message: string };

/**
 * Why `recipe` cannot be applied to `template`, or `undefined` when it can.
 * Single source for prompts (filtering), validation (errors), and `info`.
 */
export function checkRecipeCompatibility(
  recipe: RecipeConfig,
  template: TemplateConfig,
): Incompatibility | undefined {
  if (!recipeSupportsScope(recipe, template.scope)) {
    return {
      code: "scope",
      message: `Recipe '${recipe.id}' does not support template scope '${template.scope}'.`,
    };
  }

  if (
    recipe.uiFrameworks &&
    !(template.uiFramework && recipe.uiFrameworks.includes(template.uiFramework))
  ) {
    const uses = template.uiFramework ? `uses ${template.uiFramework}` : "has no UI framework";
    return {
      code: "ui-framework",
      message: `Recipe '${recipe.id}' targets ${recipe.uiFrameworks.join(" / ")}; template '${template.id}' ${uses}.`,
    };
  }

  const overlay = resolveRecipeOverlay(recipe.id, template.id);
  if (overlay.kind === "missing") {
    return {
      code: "overlay",
      message: `Recipe '${recipe.id}' has no overlay for template '${template.id}' (expected recipes/${recipe.id}/overlays/${overlay.overlayId}/). Available: ${overlay.available.join(", ") || "(none)"}.`,
    };
  }

  return undefined;
}

export function getRecipeIncompatibility(
  recipe: RecipeConfig,
  template: TemplateConfig,
): string | undefined {
  return checkRecipeCompatibility(recipe, template)?.message;
}

/** Other exclusive recipes sharing a category with `recipe` (cannot be selected together). */
export function getConflictingRecipes(recipe: RecipeConfig): string[] {
  if (!recipe.exclusive) {
    return [];
  }

  const conflicts = new Set<string>();
  for (const category of getRecipeCategories(recipe)) {
    for (const other of getRecipesByCategory(category)) {
      if (other.exclusive && other.id !== recipe.id) {
        conflicts.add(other.id);
      }
    }
  }
  return [...conflicts];
}

export function isRecipeCompatible(recipe: RecipeConfig, template: TemplateConfig): boolean {
  return getRecipeIncompatibility(recipe, template) === undefined;
}

export function getCompatibleRecipes(
  template: TemplateConfig,
  category: RecipeCategory,
): RecipeConfig[] {
  return getRecipesByCategory(category).filter((recipe) => isRecipeCompatible(recipe, template));
}

/** Compatible exclusive recipes sharing the rejected recipe's primary category. */
export function suggestAlternatives(recipeId: string, template: TemplateConfig): string[] {
  const recipe = getRecipe(recipeId);
  const primary = recipe ? getRecipeCategories(recipe)[0] : undefined;
  if (!recipe || !primary) {
    return [];
  }

  return getCompatibleRecipes(template, primary)
    .filter((candidate) => candidate.exclusive && candidate.id !== recipeId)
    .map((candidate) => candidate.id);
}
