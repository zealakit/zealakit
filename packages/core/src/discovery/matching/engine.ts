import { getRecipeIds, getTemplateIds } from "../../info/index.js";
import { resolveRecipeProfile, resolveTemplateProfile } from "../../profiles/index.js";
import type { ProjectRequirements } from "../requirements.js";
import { requiredCapabilities } from "../requirements.js";
import { evaluateRecipeConstraints } from "./constraints/recipe-constraints.js";
import { evaluateTemplateConstraints } from "./constraints/template-constraints.js";
import {
  compareRecipeMatches,
  compareTemplateMatches,
  selectNonConflictingRecipes,
  templateFrameworkPopularityRank,
  templateSimplicityRank,
} from "./ranking.js";
import { REASON_CODES, reason } from "./reasons.js";
import { scoreRecipe } from "./scoring/recipe-scoring.js";
import { scoreTemplate } from "./scoring/template-scoring.js";
import type {
  DiscoveryResult,
  MatchDiscoveryInput,
  MatchDiscoveryOptions,
  RecipeMatchResult,
  TemplateMatchResult,
} from "./types.js";
import { templateArchitectureSuitabilityRank } from "./ui-intent.js";

function matchTemplates(requirements: ProjectRequirements): {
  results: TemplateMatchResult[];
  recommendedTemplateId?: string;
  simplicity: Map<string, number>;
} {
  const simplicity = new Map<string, number>();
  const popularity = new Map<string, number>();
  const architecture = new Map<string, number>();
  const results: TemplateMatchResult[] = [];

  for (const templateId of getTemplateIds()) {
    const profile = resolveTemplateProfile(templateId);
    if (!profile) {
      results.push({
        templateId,
        score: 0,
        compatible: false,
        reasons: [
          reason(REASON_CODES.capabilityMissing, "Template is registered but has no profile."),
        ],
        warnings: [],
      });
      continue;
    }

    simplicity.set(templateId, templateSimplicityRank(profile));
    popularity.set(templateId, templateFrameworkPopularityRank(profile, requirements));
    architecture.set(templateId, templateArchitectureSuitabilityRank(profile, requirements));
    const constraints = evaluateTemplateConstraints(profile, requirements);
    if (!constraints.compatible) {
      results.push({
        templateId,
        score: 0,
        compatible: false,
        reasons: constraints.failures,
        warnings: constraints.warnings,
      });
      continue;
    }

    const scored = scoreTemplate(profile, requirements);
    results.push({
      templateId,
      score: scored.score,
      compatible: true,
      reasons: scored.reasons,
      warnings: [...constraints.warnings, ...scored.warnings],
    });
  }

  results.sort((a, b) => compareTemplateMatches(a, b, simplicity, popularity, architecture));
  const recommendedTemplateId = results.find((entry) => entry.compatible)?.templateId;

  return { results, recommendedTemplateId, simplicity };
}

function matchRecipes(
  requirements: ProjectRequirements,
  options: MatchDiscoveryOptions,
  templateCapabilities: string[],
): {
  results: RecipeMatchResult[];
  recommendedRecipeIds: string[];
} {
  const availableRecipeIds = getRecipeIds();
  const profileById = new Map(
    availableRecipeIds.map((id) => [id, resolveRecipeProfile(id)] as const),
  );

  const results: RecipeMatchResult[] = [];

  for (const recipeId of availableRecipeIds) {
    const profile = profileById.get(recipeId);
    if (!profile) {
      results.push({
        recipeId,
        score: 0,
        compatible: false,
        relevant: false,
        role: "excluded",
        reasons: [
          reason(REASON_CODES.capabilityMissing, "Recipe is registered but has no profile."),
        ],
        warnings: [],
      });
      continue;
    }

    const constraints = evaluateRecipeConstraints(profile, {
      requirements,
      templateId: options.templateId,
      selectedRecipeIds: options.selectedRecipeIds,
      templateCapabilities,
      availableRecipeIds,
    });

    if (!constraints.compatible) {
      results.push({
        recipeId,
        score: 0,
        compatible: false,
        relevant: false,
        role: "excluded",
        reasons: constraints.failures,
        warnings: constraints.warnings,
      });
      continue;
    }

    if (!constraints.relevant) {
      results.push({
        recipeId,
        score: 0,
        compatible: true,
        relevant: false,
        role: "irrelevant",
        reasons: [
          reason(
            REASON_CODES.notRelevant,
            "Does not provide capabilities required by this project.",
          ),
          ...constraints.failures,
        ],
        warnings: constraints.warnings,
      });
      continue;
    }

    const scored = scoreRecipe(profile, requirements, { templateId: options.templateId });
    results.push({
      recipeId,
      score: scored.score,
      compatible: true,
      relevant: true,
      role: "recommended",
      reasons: scored.reasons,
      warnings: [...constraints.warnings, ...scored.warnings],
    });
  }

  results.sort(compareRecipeMatches);

  const chosenRecipeIds = selectNonConflictingRecipes(
    results,
    (id) => profileById.get(id)?.conflicts ?? [],
  );

  // Pre-select exclusive category winners plus non-exclusive recipes that fill a
  // required capability. Optional extras (e.g. Storybook) stay visible in the
  // recipe list but are not checked by default.
  const neededCapabilities = requiredCapabilities(requirements);
  const recommendedRecipeIds = chosenRecipeIds.filter((recipeId) => {
    const profile = profileById.get(recipeId);
    if (!profile) return false;
    if (profile.exclusive) return true;
    return profile.capabilities.some((capability) => neededCapabilities.includes(capability));
  });

  // Mark non-chosen relevant recipes that lost to exclusivity as excluded-from-set
  const chosen = new Set(chosenRecipeIds);
  for (const entry of results) {
    if (entry.role === "recommended" && !chosen.has(entry.recipeId)) {
      entry.role = "excluded";
      entry.warnings = [
        ...entry.warnings,
        "Not selected because another higher-ranked recipe in the same exclusive category was preferred.",
      ];
    }
  }

  // Promote required dependencies of chosen recipes
  for (const recipeId of [...recommendedRecipeIds]) {
    const profile = profileById.get(recipeId);
    if (!profile) continue;
    for (const dep of profile.dependsOn) {
      if (chosen.has(dep)) continue;
      const depEntry = results.find((entry) => entry.recipeId === dep);
      if (!depEntry) continue;
      if (!depEntry.compatible) continue;
      depEntry.role = "dependency";
      depEntry.relevant = true;
      depEntry.reasons = [
        reason(
          REASON_CODES.recipeDependency,
          `Required dependency of recommended recipe '${recipeId}'.`,
        ),
        ...depEntry.reasons.filter((item) => item.code !== REASON_CODES.notRelevant),
      ];
      if (!recommendedRecipeIds.includes(dep)) {
        // dependencies are tracked via role; keep recommendedRecipeIds as direct picks only
      }
      chosen.add(dep);
    }
  }

  results.sort(compareRecipeMatches);

  return { results, recommendedRecipeIds };
}

/**
 * Deterministic Discovery matching engine.
 * Pure over the in-memory registry + profiles — no I/O.
 */
export function matchDiscovery(
  requirements: ProjectRequirements,
  options: MatchDiscoveryOptions = {},
): DiscoveryResult {
  const input: MatchDiscoveryInput = { requirements, ...options };
  const templates = matchTemplates(input.requirements);

  const templateId = input.templateId ?? templates.recommendedTemplateId;
  const templateProfile = templateId ? resolveTemplateProfile(templateId) : undefined;
  const templateCapabilities = templateProfile?.capabilities ?? [];

  const recipes = matchRecipes(input.requirements, { ...input, templateId }, templateCapabilities);

  return {
    templates: templates.results,
    recipes: recipes.results,
    recommendedTemplateId: templates.recommendedTemplateId,
    recommendedRecipeIds: recipes.recommendedRecipeIds,
  };
}
