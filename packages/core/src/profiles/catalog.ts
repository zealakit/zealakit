import { getAllRecipeIds, getAllTemplateIds, getRecipe, getTemplate } from "../registry/index.js";
import type { RecipeProfile, TemplateProfile } from "./types.js";

/**
 * Discovery profiles live on `TemplateConfig.discovery` / `RecipeConfig.discovery`
 * inside each ecosystem package; core only reads them from the registry.
 */

export function getTemplateProfile(id: string): TemplateProfile | undefined {
  const discovery = getTemplate(id)?.discovery;
  return discovery ? { id, ...discovery } : undefined;
}

export function getAllTemplateProfiles(): TemplateProfile[] {
  return getAllTemplateIds().flatMap((id) => {
    const profile = getTemplateProfile(id);
    return profile ? [profile] : [];
  });
}

export function getAllTemplateProfileIds(): string[] {
  return getAllTemplateProfiles().map((profile) => profile.id);
}

export function getRecipeProfile(id: string): RecipeProfile | undefined {
  const discovery = getRecipe(id)?.discovery;
  return discovery ? { id, ...discovery } : undefined;
}

export function getAllRecipeProfiles(): RecipeProfile[] {
  return getAllRecipeIds().flatMap((id) => {
    const profile = getRecipeProfile(id);
    return profile ? [profile] : [];
  });
}

export function getAllRecipeProfileIds(): string[] {
  return getAllRecipeProfiles().map((profile) => profile.id);
}
