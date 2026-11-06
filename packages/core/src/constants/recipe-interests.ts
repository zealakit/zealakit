import type { RecipeCategory } from "./recipe-categories.js";

/**
 * Optional Discovery soft preferences that map to recipe categories.
 * Only categories with real recipes should appear in questionnaire options.
 */
export const RECIPE_INTERESTS = [
  "state",
  "form",
  "ui",
  "fetcher",
  "orm",
  "documentation",
  "testing",
] as const satisfies readonly RecipeCategory[];

export type RecipeInterest = (typeof RECIPE_INTERESTS)[number];
