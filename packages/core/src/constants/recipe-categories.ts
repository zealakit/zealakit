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
  "auth",
  "ci",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
