/** Template scoring weights (sum = 100). Only applicable criteria contribute. */
export const TEMPLATE_SCORE_WEIGHTS = {
  projectType: 25,
  capabilities: 25,
  runtimeFramework: 20,
  scopeFit: 15,
  architecture: 10,
  deployment: 5,
} as const;

export type TemplateScoreCriterion = keyof typeof TEMPLATE_SCORE_WEIGHTS;

/** Recipe scoring weights (sum = 100). Only applicable criteria contribute. */
export const RECIPE_SCORE_WEIGHTS = {
  capabilities: 40,
  scope: 20,
  framework: 15,
  projectType: 15,
  integration: 10,
} as const;

export type RecipeScoreCriterion = keyof typeof RECIPE_SCORE_WEIGHTS;

/** Normalize earned points over applicable weight total into 0–100. */
export function normalizeScore(earned: number, applicable: number): number {
  if (applicable <= 0) {
    return 0;
  }
  const raw = (earned / applicable) * 100;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}
