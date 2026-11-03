import {
  getRecipe,
  getRecipeCategories,
  getRecipesByCategory,
  recipeSupportsScope,
} from "./registry/index.js";
import { resolveRecipeOverlay } from "./scaffold/paths.js";
import type { RecipeCategory, RecipeConfig, TemplateConfig } from "./types.js";

/**
 * Why `recipe` cannot be applied to `template`, or `undefined` when it can.
 * Single source for prompts (filtering) and validation (errors).
 */
export function getRecipeIncompatibility(
  recipe: RecipeConfig,
  template: TemplateConfig,
): string | undefined {
  if (!recipeSupportsScope(recipe, template.scope)) {
    return `Recipe '${recipe.id}' does not support template scope '${template.scope}'.`;
  }

  if (
    recipe.frameworks &&
    !(template.framework && recipe.frameworks.includes(template.framework))
  ) {
    const uses = template.framework ? `uses ${template.framework}` : "has no UI framework";
    return `Recipe '${recipe.id}' targets ${recipe.frameworks.join(" / ")}; template '${template.id}' ${uses}.`;
  }

  const overlay = resolveRecipeOverlay(recipe.id, template.id);
  if (overlay.kind === "missing") {
    return `Recipe '${recipe.id}' has no overlay for template '${template.id}' (expected recipes/${recipe.id}/overlays/${overlay.overlayId}/). Available: ${overlay.available.join(", ") || "(none)"}.`;
  }

  return undefined;
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
