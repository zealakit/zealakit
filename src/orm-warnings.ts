import { getRecipe, getRecipeCategories } from "./registry/index.js";
import type { RecipeConfig, TemplateConfig } from "./types.js";

/** Shown when an ORM is selected on Next/Nuxt (hybrid) templates. */
export const HYBRID_ORM_WARNING =
  "Hybrid apps (Next.js, Nuxt, etc.) are not a dedicated backend. ORM on hybrid is best-effort for small projects — prefer a dedicated backend framework for production APIs and clearer layering.";

export function recipeIsOrm(recipe: RecipeConfig): boolean {
  return getRecipeCategories(recipe).includes("orm");
}

/** Recipe ids in `recipeIds` that are ORMs on a hybrid template. */
export function hybridOrmSelections(template: TemplateConfig, recipeIds: string[]): string[] {
  if (template.scope !== "hybrid") {
    return [];
  }
  return recipeIds.filter((id) => {
    const recipe = getRecipe(id);
    return recipe ? recipeIsOrm(recipe) : false;
  });
}
