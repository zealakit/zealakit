import { RECIPE_PROFILES } from "./recipe-profiles/index.js";
import { TEMPLATE_PROFILES } from "./template-profiles/index.js";
import type { RecipeProfile, TemplateProfile } from "./types.js";

function indexById<T extends { id: string }>(profiles: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const profile of profiles) {
    if (map.has(profile.id)) {
      throw new Error(`Duplicate profile id '${profile.id}'`);
    }
    map.set(profile.id, profile);
  }
  return map;
}

const templateProfiles = indexById(TEMPLATE_PROFILES);
const recipeProfiles = indexById(RECIPE_PROFILES);

export function getTemplateProfile(id: string): TemplateProfile | undefined {
  return templateProfiles.get(id);
}

export function getAllTemplateProfiles(): TemplateProfile[] {
  return [...templateProfiles.values()];
}

export function getAllTemplateProfileIds(): string[] {
  return [...templateProfiles.keys()];
}

export function getRecipeProfile(id: string): RecipeProfile | undefined {
  return recipeProfiles.get(id);
}

export function getAllRecipeProfiles(): RecipeProfile[] {
  return [...recipeProfiles.values()];
}

export function getAllRecipeProfileIds(): string[] {
  return [...recipeProfiles.keys()];
}
