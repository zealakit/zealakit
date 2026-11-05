import type { ResolvedTemplateProfile } from "../../profiles/types.js";
import type { RecipeMatchResult, TemplateMatchResult } from "./types.js";

/** Lower is simpler — used as a deterministic tie-breaker. */
export function templateSimplicityRank(profile: ResolvedTemplateProfile): number {
  const levels = profile.architectureLevels ?? [];
  const arch = levels.includes("minimal") ? 0 : levels.includes("balanced") ? 1 : 2;
  return arch * 100 + profile.capabilities.length;
}

export function compareTemplateMatches(
  a: TemplateMatchResult,
  b: TemplateMatchResult,
  simplicity: Map<string, number>,
): number {
  if (a.compatible !== b.compatible) {
    return a.compatible ? -1 : 1;
  }
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  const simA = simplicity.get(a.templateId) ?? 0;
  const simB = simplicity.get(b.templateId) ?? 0;
  if (simA !== simB) {
    return simA - simB;
  }
  return a.templateId.localeCompare(b.templateId);
}

export function compareRecipeMatches(a: RecipeMatchResult, b: RecipeMatchResult): number {
  const roleRank = (role: RecipeMatchResult["role"]): number => {
    switch (role) {
      case "recommended":
        return 0;
      case "dependency":
        return 1;
      case "irrelevant":
        return 2;
      case "excluded":
        return 3;
    }
  };
  const roleDiff = roleRank(a.role) - roleRank(b.role);
  if (roleDiff !== 0) {
    return roleDiff;
  }
  if (a.relevant !== b.relevant) {
    return a.relevant ? -1 : 1;
  }
  if (a.compatible !== b.compatible) {
    return a.compatible ? -1 : 1;
  }
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return a.recipeId.localeCompare(b.recipeId);
}

/**
 * Greedy pick of non-conflicting recipes by score.
 * `conflictsOf(id)` returns recipe ids that conflict with `id`.
 */
export function selectNonConflictingRecipes(
  ranked: RecipeMatchResult[],
  conflictsOf: (recipeId: string) => string[],
): string[] {
  const chosen: string[] = [];
  const blocked = new Set<string>();

  for (const candidate of ranked) {
    if (!candidate.relevant || !candidate.compatible || candidate.role === "excluded") {
      continue;
    }
    if (blocked.has(candidate.recipeId)) {
      continue;
    }
    chosen.push(candidate.recipeId);
    for (const conflictId of conflictsOf(candidate.recipeId)) {
      blocked.add(conflictId);
    }
  }

  return chosen;
}
