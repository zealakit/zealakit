import type { ResolvedRecipeProfile } from "../../../profiles/types.js";
import { type ProjectRequirements, requiredCapabilities } from "../../requirements.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";
import { normalizeScore, RECIPE_SCORE_WEIGHTS } from "../weights.js";

export type RecipeScoreBreakdown = {
  score: number;
  reasons: MatchReason[];
  warnings: string[];
};

/**
 * Score a relevant, compatible recipe against project needs.
 */
export function scoreRecipe(
  profile: ResolvedRecipeProfile,
  requirements: ProjectRequirements,
  options?: { templateId?: string },
): RecipeScoreBreakdown {
  let earned = 0;
  let applicable = 0;
  const reasons: MatchReason[] = [];
  const warnings: string[] = [];
  const needed = requiredCapabilities(requirements);

  // Capability match
  const overlapping = profile.capabilities.filter((capability) => needed.includes(capability));
  const databaseOverlap =
    requirements.databases?.some((db) => profile.databases?.includes(db)) ?? false;

  if (needed.length > 0 || requirements.databases?.length) {
    applicable += RECIPE_SCORE_WEIGHTS.capabilities;
    let ratio = 0;
    if (needed.length > 0) {
      ratio = overlapping.length / needed.length;
    }
    if (databaseOverlap) {
      ratio = Math.max(ratio, overlapping.length > 0 ? ratio : 0.5);
      reasons.push(
        reason(
          REASON_CODES.databaseMatch,
          `Supports preferred database(s): ${(requirements.databases ?? [])
            .filter((db) => profile.databases?.includes(db))
            .join(", ")}.`,
        ),
      );
    }
    if (overlapping.length > 0) {
      const points = RECIPE_SCORE_WEIGHTS.capabilities * Math.min(1, ratio);
      earned += points;
      reasons.push(
        reason(
          REASON_CODES.capabilityMatch,
          `Provides ${overlapping.join(", ")}.`,
          Math.round(points * 100) / 100,
        ),
      );
    } else if (databaseOverlap) {
      earned += RECIPE_SCORE_WEIGHTS.capabilities * 0.5;
    }
  }

  // Scope
  applicable += RECIPE_SCORE_WEIGHTS.scope;
  if (requirements.scopes.length === 0 || profile.scopes === "all") {
    earned += RECIPE_SCORE_WEIGHTS.scope;
    reasons.push(
      reason(
        REASON_CODES.scopeMatch,
        "Compatible with your project scopes.",
        RECIPE_SCORE_WEIGHTS.scope,
      ),
    );
  } else if (profile.scopes.some((scope) => requirements.scopes.includes(scope))) {
    earned += RECIPE_SCORE_WEIGHTS.scope;
    reasons.push(
      reason(
        REASON_CODES.scopeMatch,
        "Compatible with your project scopes.",
        RECIPE_SCORE_WEIGHTS.scope,
      ),
    );
  }

  // Framework
  if (requirements.frontend?.framework || profile.uiFrameworks?.length) {
    applicable += RECIPE_SCORE_WEIGHTS.framework;
    if (!profile.uiFrameworks?.length) {
      // UI-agnostic recipe: full credit when no UI constraint, partial when UI is set
      if (!requirements.frontend?.framework) {
        earned += RECIPE_SCORE_WEIGHTS.framework;
      } else {
        earned += RECIPE_SCORE_WEIGHTS.framework;
        reasons.push(
          reason(
            REASON_CODES.frontendFrameworkMatch,
            "UI-agnostic recipe; works with your frontend framework.",
            RECIPE_SCORE_WEIGHTS.framework,
          ),
        );
      }
    } else if (
      requirements.frontend?.framework &&
      profile.uiFrameworks.includes(requirements.frontend.framework)
    ) {
      earned += RECIPE_SCORE_WEIGHTS.framework;
      reasons.push(
        reason(
          REASON_CODES.frontendFrameworkMatch,
          `Supports the required ${requirements.frontend.framework} frontend.`,
          RECIPE_SCORE_WEIGHTS.framework,
        ),
      );
    } else if (!requirements.frontend?.framework) {
      earned += RECIPE_SCORE_WEIGHTS.framework * 0.5;
    }
  }

  // Project type
  if (profile.projectTypes?.length && requirements.projectType !== "unknown") {
    applicable += RECIPE_SCORE_WEIGHTS.projectType;
    if (profile.projectTypes.includes(requirements.projectType)) {
      earned += RECIPE_SCORE_WEIGHTS.projectType;
      reasons.push(
        reason(
          REASON_CODES.projectTypeMatch,
          "Matches your selected project type.",
          RECIPE_SCORE_WEIGHTS.projectType,
        ),
      );
    }
  }

  // Integration fit (dependsOn / template context)
  applicable += RECIPE_SCORE_WEIGHTS.integration;
  let integration = RECIPE_SCORE_WEIGHTS.integration;
  if (profile.dependsOn.length > 0) {
    integration *= 0.7;
    warnings.push(`This recipe requires other recipe(s): ${profile.dependsOn.join(", ")}.`);
    reasons.push(
      reason(REASON_CODES.recipeDependency, `Depends on ${profile.dependsOn.join(", ")}.`),
    );
  }
  if (options?.templateId) {
    reasons.push(
      reason(REASON_CODES.templateCompat, `Compatible with template '${options.templateId}'.`),
    );
  }
  earned += integration;

  return {
    score: normalizeScore(earned, applicable),
    reasons,
    warnings,
  };
}
