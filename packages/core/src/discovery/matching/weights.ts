/**
 * Template scoring weights (sum = 100). Only applicable criteria contribute.
 *
 * Soft signals stay separate: architecture fit, purpose, ecosystem preference,
 * and Backend/API scalability (`scalabilityFit`, only when traffic is set).
 */
export const TEMPLATE_SCORE_WEIGHTS = {
  projectType: 22,
  capabilities: 18,
  runtimeFramework: 14,
  scopeFit: 8,
  /** Soft rendering / delivery suitability (preferredMode). */
  architectureFit: 8,
  /** Soft project-purpose alignment. */
  purposeFit: 4,
  /**
   * Default ecosystem preference when none was chosen:
   * UI React → Vue → Svelte; Backend/API Node → Go (dampened under high traffic).
   */
  frameworkEcosystem: 12,
  /**
   * Soft Backend/API traffic / concurrency fit from `trafficExpectation`.
   * Applicable only when the user answered the traffic question.
   */
  scalabilityFit: 10,
  architecture: 2,
  deployment: 2,
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
