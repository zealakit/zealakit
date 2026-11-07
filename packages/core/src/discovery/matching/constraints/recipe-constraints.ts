import { checkRecipeCompatibility } from "../../../compat.js";
import type { ResolvedRecipeProfile } from "../../../profiles/types.js";
import { getRecipe, getTemplate } from "../../../registry/index.js";
import {
  getRequirementsFrontend,
  type ProjectRequirements,
  requiredCapabilities,
} from "../../requirements.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";

export type RecipeConstraintResult = {
  compatible: boolean;
  relevant: boolean;
  failures: MatchReason[];
  warnings: string[];
};

export type RecipeConstraintContext = {
  requirements: ProjectRequirements;
  templateId?: string;
  selectedRecipeIds?: string[];
  /** Capabilities already provided by the selected/recommended template. */
  templateCapabilities?: string[];
  /** All registered recipe ids (for dependency availability). */
  availableRecipeIds: string[];
};

/**
 * Hard eligibility + relevance for a recipe.
 * Tooling recipes with no overlapping needed capabilities are irrelevant, not failures.
 */
export function evaluateRecipeConstraints(
  profile: ResolvedRecipeProfile,
  context: RecipeConstraintContext,
): RecipeConstraintResult {
  const failures: MatchReason[] = [];
  const warnings: string[] = [];
  const { requirements } = context;
  const needed = requiredCapabilities(requirements);
  const selected = new Set(context.selectedRecipeIds ?? []);

  if (profile.projectTypes && profile.projectTypes.length > 0) {
    if (!profile.projectTypes.includes(requirements.projectType)) {
      failures.push(
        reason(
          REASON_CODES.projectTypeMismatch,
          `Does not apply to project type '${requirements.projectType}'.`,
        ),
      );
    }
  }

  if (requirements.scopes.length > 0 && profile.scopes !== "all") {
    const overlap = profile.scopes.some((scope) => requirements.scopes.includes(scope));
    if (!overlap) {
      failures.push(
        reason(
          REASON_CODES.scopeMismatch,
          `Does not support your preferred scopes (${requirements.scopes.join(", ")}).`,
        ),
      );
    }
  }

  if (profile.requires?.length) {
    for (const capability of profile.requires) {
      const available =
        needed.includes(capability) ||
        (context.templateCapabilities?.includes(capability) ?? false);
      if (!available) {
        failures.push(
          reason(
            REASON_CODES.recipeRequires,
            `Requires capability '${capability}' which is not present in the project requirements.`,
          ),
        );
      }
    }
  }

  if (profile.excludes?.length) {
    for (const capability of profile.excludes) {
      if (needed.includes(capability)) {
        failures.push(
          reason(
            REASON_CODES.recipeExcludes,
            `Conflicts with required capability '${capability}'.`,
          ),
        );
      }
    }
  }

  const uiFramework = getRequirementsFrontend(requirements)?.framework;
  if (uiFramework && profile.uiFrameworks?.length) {
    if (!profile.uiFrameworks.includes(uiFramework)) {
      failures.push(
        reason(
          REASON_CODES.frontendFrameworkMismatch,
          `Targets ${profile.uiFrameworks.join(" / ")}; you require '${uiFramework}'.`,
        ),
      );
    }
  }

  for (const dep of profile.dependsOn) {
    if (!context.availableRecipeIds.includes(dep)) {
      failures.push(
        reason(REASON_CODES.recipeDependencyMissing, `Depends on unavailable recipe '${dep}'.`),
      );
    }
  }

  for (const conflictId of profile.conflicts) {
    if (selected.has(conflictId)) {
      failures.push(
        reason(
          REASON_CODES.recipeConflict,
          `Conflicts with already selected recipe '${conflictId}'.`,
        ),
      );
    }
  }

  if (context.templateId) {
    const template = getTemplate(context.templateId);
    const recipe = getRecipe(profile.id);
    if (template && recipe) {
      const incompat = checkRecipeCompatibility(recipe, template);
      if (incompat) {
        failures.push(reason(REASON_CODES.templateIncompat, incompat.message));
      }
    }
  }

  const provided = profile.capabilities;
  const overlapping = provided.filter((capability) => needed.includes(capability));
  const databaseRelevant =
    Boolean(requirements.databases?.length) && Boolean(profile.databases?.length);
  const databaseMismatch =
    Boolean(requirements.databases?.length) &&
    Boolean(profile.databases?.length) &&
    !requirements.databases?.some((db) => profile.databases?.includes(db));
  const interestRelevant = Boolean(
    requirements.recipeInterests?.some((interest) => profile.categories.includes(interest)),
  );

  let relevant =
    !databaseMismatch &&
    (overlapping.length > 0 ||
      databaseRelevant ||
      interestRelevant ||
      profile.alwaysRelevant === true);

  // Redundancy only applies when the recipe contributes a capability that the
  // template already provides. Interest/tooling relevance is not "covered" by
  // the template's base capabilities (e.g. a linter or Storybook).
  if (relevant && overlapping.length > 0 && context.templateCapabilities?.length) {
    const novel = overlapping.filter(
      (capability) => !context.templateCapabilities?.includes(capability),
    );
    if (novel.length === 0 && !databaseRelevant) {
      relevant = false;
      warnings.push(
        "Functionality is already covered by the selected template; recipe is redundant.",
      );
    }
  }

  const compatible = failures.length === 0;
  return {
    compatible,
    relevant: compatible && relevant,
    failures,
    warnings,
  };
}
