import type { RecipeConfig } from "@zealakit/core";

/** Identity helper for typed Go recipe modules. */
export function defineGoRecipe(recipe: RecipeConfig): RecipeConfig {
  return {
    ...recipe,
    path: recipe.path ?? `go/${recipe.id}`,
    ecosystem: recipe.ecosystem ?? "go",
  };
}
