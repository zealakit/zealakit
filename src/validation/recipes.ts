import { getRecipeIncompatibility, suggestAlternatives } from "../compat.js";
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
  return result([
    `Template "${templateId}" does not exist. Available templates: ${getAllTemplateIds().join(", ")}.`,
  ]);
}

export function validateRecipeIds(recipeIds: string[]): ValidationResult {
  const unknown = recipeIds.filter((id) => !getRecipe(id));
  if (unknown.length === 0) {
    return result([]);
  }
  return result([`Invalid recipe(s): ${unknown.map((id) => `'${id}'`).join(", ")}.`]);
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
      const names = ids.map((id) => `'${id}'`).join(" and ");
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the ${category} group. Please choose only one.`,
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
    const hint = alternatives.length > 0 ? ` Try: ${alternatives.join(", ")}.` : "";
    errors.push(`✖ ${reason}${hint}`);
  }
  return result(errors);
}
