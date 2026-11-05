/** Exclusive / tagged recipe groups used by prompts and compat. */
export const RECIPE_CATEGORIES = [
  "linter",
  "state",
  "ui",
  "form",
  "fetcher",
  "orm",
  "infrastructure",
  "utils",
  "testing",
  "documentation",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
