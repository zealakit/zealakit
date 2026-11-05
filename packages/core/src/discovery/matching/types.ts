import type { ProjectRequirements } from "../requirements.js";

export type MatchReason = {
  code: string;
  message: string;
  /** Criterion weight that contributed when this is a positive scoring reason. */
  weight?: number;
};

export type TemplateMatchResult = {
  templateId: string;
  score: number;
  compatible: boolean;
  reasons: MatchReason[];
  warnings: string[];
};

export type RecipeMatchRole = "recommended" | "dependency" | "excluded" | "irrelevant";

export type RecipeMatchResult = {
  recipeId: string;
  score: number;
  compatible: boolean;
  relevant: boolean;
  role: RecipeMatchRole;
  reasons: MatchReason[];
  warnings: string[];
};

export type DiscoveryResult = {
  templates: TemplateMatchResult[];
  recipes: RecipeMatchResult[];
  /** Highest-ranked compatible template, if any. */
  recommendedTemplateId?: string;
  /** Directly recommended recipe ids (not auto-dependencies). */
  recommendedRecipeIds: string[];
};

export type MatchDiscoveryOptions = {
  /**
   * When set, recipe overlay / scope / UI-framework compatibility is evaluated
   * against this registered template via `checkRecipeCompatibility`.
   */
  templateId?: string;
  /** Recipes already chosen — used for conflict and dependency checks. */
  selectedRecipeIds?: string[];
};

export type MatchDiscoveryInput = {
  requirements: ProjectRequirements;
} & MatchDiscoveryOptions;
