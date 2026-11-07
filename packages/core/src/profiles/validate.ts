import { getConflictingRecipes } from "../compat.js";
import {
  API_TRAFFIC_EXPECTATIONS,
  ARCHITECTURE_LEVELS,
  BACKEND_FRAMEWORKS,
  BACKEND_RUNTIMES,
  CAPABILITIES,
  DATABASE_TYPES,
  DEPLOYMENT_TARGETS,
  FRONTEND_DELIVERIES,
  FRONTEND_MODES,
  PROJECT_PURPOSES,
  PROJECT_TYPES,
} from "../constants.js";
import { getAllRecipeIds, getAllTemplateIds, getRecipe } from "../registry/index.js";
import type { ValidationResult } from "../types.js";
import { getAllRecipeProfiles, getAllTemplateProfiles } from "./catalog.js";
import type { RecipeProfile, TemplateProfile } from "./types.js";

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

function assertMembers(
  errors: string[],
  label: string,
  values: readonly string[] | undefined,
  allowed: readonly string[],
): void {
  if (!values) {
    return;
  }
  for (const value of values) {
    if (!allowed.includes(value)) {
      errors.push(`${label} has unknown value '${value}'.`);
    }
  }
}

function findDuplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      dupes.add(id);
    }
    seen.add(id);
  }
  return [...dupes];
}

export type ProfileValidationInput = {
  templateIds?: string[];
  recipeIds?: string[];
  templateProfiles?: readonly TemplateProfile[];
  recipeProfiles?: readonly RecipeProfile[];
  /** Resolve a recipe for dependsOn / exclusivity checks (defaults to registry). */
  getRecipeById?: typeof getRecipe;
  getConflicts?: typeof getConflictingRecipes;
};

/**
 * Consistency checks for Discovery profiles against the live template/recipe registry.
 * Does not change scaffolding behavior.
 */
export function validateProfiles(input: ProfileValidationInput = {}): ValidationResult {
  const errors: string[] = [];

  const templateIds = input.templateIds ?? getAllTemplateIds();
  const recipeIds = input.recipeIds ?? getAllRecipeIds();
  const templateProfiles = input.templateProfiles ?? getAllTemplateProfiles();
  const recipeProfiles = input.recipeProfiles ?? getAllRecipeProfiles();
  const lookupRecipe = input.getRecipeById ?? getRecipe;
  const lookupConflicts = input.getConflicts ?? getConflictingRecipes;

  const templateProfileIds = templateProfiles.map((profile) => profile.id);
  const recipeProfileIds = recipeProfiles.map((profile) => profile.id);

  for (const id of findDuplicateIds(templateProfileIds)) {
    errors.push(`Duplicate template profile id '${id}'.`);
  }
  for (const id of findDuplicateIds(recipeProfileIds)) {
    errors.push(`Duplicate recipe profile id '${id}'.`);
  }

  for (const id of templateProfileIds) {
    if (!templateIds.includes(id)) {
      errors.push(`Template profile '${id}' has no registered template.`);
    }
  }
  for (const id of templateIds) {
    if (!templateProfileIds.includes(id)) {
      errors.push(`Registered template '${id}' is missing a profile.`);
    }
  }

  for (const id of recipeProfileIds) {
    if (!recipeIds.includes(id)) {
      errors.push(`Recipe profile '${id}' has no registered recipe.`);
    }
  }
  for (const id of recipeIds) {
    if (!recipeProfileIds.includes(id)) {
      errors.push(`Registered recipe '${id}' is missing a profile.`);
    }
  }

  for (const profile of templateProfiles) {
    const label = `Template profile '${profile.id}'`;
    assertMembers(errors, `${label} projectTypes`, profile.projectTypes, PROJECT_TYPES);
    if (profile.projectTypes.length === 0) {
      errors.push(`${label} must declare at least one projectType.`);
    }
    assertMembers(errors, `${label} purposes`, profile.purposes, PROJECT_PURPOSES);
    assertMembers(errors, `${label} frontendModes`, profile.frontendModes, FRONTEND_MODES);
    if (
      profile.delivery &&
      !(FRONTEND_DELIVERIES as readonly string[]).includes(profile.delivery)
    ) {
      errors.push(`${label} has unknown delivery '${profile.delivery}'.`);
    }
    assertMembers(errors, `${label} capabilities`, profile.capabilities, CAPABILITIES);
    assertMembers(errors, `${label} databases`, profile.databases, DATABASE_TYPES);
    assertMembers(
      errors,
      `${label} deploymentTargets`,
      profile.deploymentTargets,
      DEPLOYMENT_TARGETS,
    );
    assertMembers(
      errors,
      `${label} architectureLevels`,
      profile.architectureLevels,
      ARCHITECTURE_LEVELS,
    );
    assertMembers(
      errors,
      `${label} trafficExpectations`,
      profile.trafficExpectations,
      API_TRAFFIC_EXPECTATIONS,
    );

    if (profile.backend) {
      assertMembers(
        errors,
        `${label} backend.runtimes`,
        profile.backend.runtimes,
        BACKEND_RUNTIMES,
      );
      if (profile.backend.runtimes.length === 0) {
        errors.push(`${label} backend.runtimes must not be empty when backend is set.`);
      }
      assertMembers(
        errors,
        `${label} backend.frameworks`,
        profile.backend.frameworks,
        BACKEND_FRAMEWORKS,
      );
    }
  }

  for (const profile of recipeProfiles) {
    const label = `Recipe profile '${profile.id}'`;
    assertMembers(errors, `${label} capabilities`, profile.capabilities, CAPABILITIES);
    assertMembers(errors, `${label} projectTypes`, profile.projectTypes, PROJECT_TYPES);
    assertMembers(errors, `${label} requires`, profile.requires, CAPABILITIES);
    assertMembers(errors, `${label} excludes`, profile.excludes, CAPABILITIES);
    assertMembers(errors, `${label} databases`, profile.databases, DATABASE_TYPES);

    const recipe = lookupRecipe(profile.id);
    if (!recipe) {
      continue;
    }

    for (const dep of recipe.dependsOn ?? []) {
      if (dep === recipe.id) {
        errors.push(`Recipe '${recipe.id}' cannot depend on itself.`);
      }
      if (!recipeIds.includes(dep)) {
        errors.push(`Recipe '${recipe.id}' dependsOn unknown recipe '${dep}'.`);
      }
    }

    const conflicts = lookupConflicts(recipe);
    if (conflicts.includes(recipe.id)) {
      errors.push(`Recipe '${recipe.id}' cannot conflict with itself.`);
    }
    for (const conflictId of conflicts) {
      if (!recipeIds.includes(conflictId)) {
        errors.push(`Recipe '${recipe.id}' conflicts with unknown recipe '${conflictId}'.`);
      }
    }
  }

  return result(errors);
}
