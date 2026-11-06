import { getConflictingRecipes } from "../compat.js";
import { getRecipe, getRecipeCategories, getTemplate } from "../registry/index.js";
import { getRecipeProfile, getTemplateProfile } from "./catalog.js";
import type { ResolvedRecipeProfile, ResolvedTemplateProfile } from "./types.js";

/** Merge authored template profile with live `TemplateConfig` fields. */
export function resolveTemplateProfile(id: string): ResolvedTemplateProfile | undefined {
  const template = getTemplate(id);
  const profile = getTemplateProfile(id);
  if (!template || !profile) {
    return undefined;
  }

  const frontend =
    profile.frontendModes || template.uiFramework
      ? {
          frameworks: template.uiFramework ? [template.uiFramework] : [],
          modes: profile.frontendModes ? [...profile.frontendModes] : [],
        }
      : undefined;

  return {
    ...profile,
    scope: template.scope,
    scopes: [template.scope],
    uiFramework: template.uiFramework,
    ecosystem: template.ecosystem ?? "node",
    frontend,
  };
}

/** Merge authored recipe profile with live `RecipeConfig` + exclusivity conflicts. */
export function resolveRecipeProfile(id: string): ResolvedRecipeProfile | undefined {
  const recipe = getRecipe(id);
  const profile = getRecipeProfile(id);
  if (!recipe || !profile) {
    return undefined;
  }

  return {
    ...profile,
    categories: getRecipeCategories(recipe),
    scopes: recipe.supportedScopes,
    uiFrameworks: recipe.uiFrameworks ? [...recipe.uiFrameworks] : undefined,
    dependsOn: [...(recipe.dependsOn ?? [])],
    conflicts: getConflictingRecipes(recipe),
    exclusive: recipe.exclusive === true,
  };
}
