import { getRecipeIncompatibility, suggestAlternatives } from "../compat.js";
import {
  formatDiagnostic,
  incompatDiagnostic,
  recipeConflictDiagnostic,
  unknownRecipesDiagnostic,
  unknownTemplateDiagnostic,
} from "../diagnostics.js";
import {
  getAllTemplateIds,
  getRecipe,
  getRecipeCategories,
  getTemplate,
} from "../registry/index.js";
import type { ValidationResult } from "../types.js";

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

export function validateTemplate(templateId: string): ValidationResult {
  if (getTemplate(templateId)) {
    return result([]);
  }
  return result([formatDiagnostic(unknownTemplateDiagnostic(templateId, getAllTemplateIds()))]);
}

export function validateRecipeIds(recipeIds: string[]): ValidationResult {
  const unknown = recipeIds.filter((id) => !getRecipe(id));
  if (unknown.length === 0) {
    return result([]);
  }
  return result([formatDiagnostic(unknownRecipesDiagnostic(unknown))]);
}

/** At most one exclusive recipe per category (non-exclusive ones like Storybook may coexist). */
export function validateRecipeConflicts(recipeIds: string[]): ValidationResult {
  const exclusiveByCategory = new Map<string, string[]>();

  for (const recipeId of new Set(recipeIds)) {
    const recipe = getRecipe(recipeId);
    if (!recipe?.exclusive) {
      continue;
    }
    for (const category of getRecipeCategories(recipe)) {
      exclusiveByCategory.set(category, [...(exclusiveByCategory.get(category) ?? []), recipeId]);
    }
  }

  const errors: string[] = [];
  for (const [category, ids] of exclusiveByCategory) {
    if (ids.length > 1) {
      errors.push(formatDiagnostic(recipeConflictDiagnostic(category, ids)));
    }
  }
  return result(errors);
}

/** Every recipe's `requiresAnyOf` must be satisfied by the selection. */
export function validateRecipeRequirements(recipeIds: string[]): ValidationResult {
  const selected = new Set(recipeIds);
  const errors: string[] = [];
  for (const recipeId of selected) {
    const needs = getRecipe(recipeId)?.requiresAnyOf;
    if (needs && needs.length > 0 && !needs.some((id) => selected.has(id))) {
      errors.push(
        formatDiagnostic({
          title: "Recipe needs another recipe",
          selected: [recipeId],
          reason: `Recipe '${recipeId}' requires one of: ${needs.join(", ")}.`,
          resolution: `Add one of ${needs.map((id) => `'${id}'`).join(" or ")} with -w.`,
        }),
      );
    }
  }
  return result(errors);
}

/** Scope, UI framework, and overlay availability for every recipe on the template. */
export function validateRecipeCompatibility(
  templateId: string,
  recipeIds: string[],
): ValidationResult {
  const template = getTemplate(templateId);
  if (!template) {
    return result([]);
  }

  const errors: string[] = [];
  for (const recipeId of recipeIds) {
    const recipe = getRecipe(recipeId);
    const reason = recipe && getRecipeIncompatibility(recipe, template);
    if (!reason) {
      continue;
    }
    const alternatives = suggestAlternatives(recipeId, template);
    errors.push(formatDiagnostic(incompatDiagnostic(recipeId, reason, alternatives)));
  }
  return result(errors);
}
