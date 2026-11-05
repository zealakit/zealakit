export { evaluateRecipeConstraints } from "./constraints/recipe-constraints.js";
export { evaluateTemplateConstraints } from "./constraints/template-constraints.js";
export { matchDiscovery } from "./engine.js";
export { formatNoCompatibleTemplateMessage } from "./explain.js";
export {
  compareRecipeMatches,
  compareTemplateMatches,
  selectNonConflictingRecipes,
  templateSimplicityRank,
} from "./ranking.js";
export { REASON_CODES, type ReasonCode, reason } from "./reasons.js";
export { scoreRecipe } from "./scoring/recipe-scoring.js";
export { scoreTemplate } from "./scoring/template-scoring.js";
export type {
  DiscoveryResult,
  MatchDiscoveryInput,
  MatchDiscoveryOptions,
  MatchReason,
  RecipeMatchResult,
  RecipeMatchRole,
  TemplateMatchResult,
} from "./types.js";
export {
  normalizeScore,
  RECIPE_SCORE_WEIGHTS,
  type RecipeScoreCriterion,
  TEMPLATE_SCORE_WEIGHTS,
  type TemplateScoreCriterion,
} from "./weights.js";
