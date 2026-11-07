import { checkRecipeCompatibility } from "../compat.js";
import type { Capability, ProjectType } from "../constants.js";
import {
  CAPABILITIES,
  ECOSYSTEMS,
  isSupportedProjectType,
  PROJECT_TYPES,
  RECIPE_CATEGORIES,
  SCOPES,
  UI_FRAMEWORKS,
} from "../constants.js";
import { getRecipeProfile, getTemplateProfile } from "../profiles/index.js";
import {
  getRecipe,
  getRecipesByCategory,
  getTemplate,
  recipeHasCategory,
  recipeSupportsScope,
} from "../registry/index.js";
import type { EcosystemId, RecipeConfig, TemplateConfig } from "../types.js";
import type { InfoFilter, InfoFilterInput, NormalizeInfoFilterResult } from "./types.js";

/** Ecosystem ownership: explicit registry field, then `recipes/<ecosystem>/` path. */
export function getTemplateEcosystem(template: TemplateConfig): EcosystemId {
  return template.ecosystem ?? "node";
}

export function getRecipeEcosystem(recipe: RecipeConfig): EcosystemId {
  if (recipe.ecosystem) {
    return recipe.ecosystem;
  }
  const prefix = recipe.path?.split("/")[0] ?? "";
  return (ECOSYSTEMS as readonly string[]).includes(prefix) ? (prefix as EcosystemId) : "node";
}

function isMember<T extends string>(values: readonly T[], value: string | undefined): value is T {
  return value !== undefined && (values as readonly string[]).includes(value);
}

function describeAllowed(label: string, value: string, values: readonly string[]): string {
  return `Unknown ${label} '${value}'. Allowed: ${values.join(", ")}.`;
}

/**
 * Validate raw filter input and convert it into a typed `InfoFilter`.
 * Unknown values are reported instead of being silently dropped.
 */
export function normalizeInfoFilter(input: InfoFilterInput = {}): NormalizeInfoFilterResult {
  const errors: string[] = [];
  const filter: InfoFilter = {};

  if (input.ecosystem !== undefined) {
    if (isMember(ECOSYSTEMS, input.ecosystem)) {
      filter.ecosystem = input.ecosystem;
    } else {
      errors.push(describeAllowed("ecosystem", input.ecosystem, ECOSYSTEMS));
    }
  }

  if (input.scope !== undefined) {
    if (isMember(SCOPES, input.scope)) {
      filter.scope = input.scope;
    } else {
      errors.push(describeAllowed("scope", input.scope, SCOPES));
    }
  }

  if (input.projectType !== undefined) {
    if (isMember(PROJECT_TYPES, input.projectType)) {
      filter.projectType = input.projectType;
    } else {
      errors.push(describeAllowed("project type", input.projectType, PROJECT_TYPES));
    }
  }

  if (input.uiFramework !== undefined) {
    if (isMember(UI_FRAMEWORKS, input.uiFramework)) {
      filter.uiFramework = input.uiFramework;
    } else {
      errors.push(describeAllowed("UI framework", input.uiFramework, UI_FRAMEWORKS));
    }
  }

  if (input.capability !== undefined) {
    if (isMember(CAPABILITIES, input.capability)) {
      filter.capability = input.capability;
    } else {
      errors.push(describeAllowed("capability", input.capability, CAPABILITIES));
    }
  }

  if (input.category !== undefined) {
    if (isMember(RECIPE_CATEGORIES, input.category)) {
      filter.category = input.category;
    } else {
      errors.push(describeAllowed("recipe category", input.category, RECIPE_CATEGORIES));
    }
  }

  if (input.templateId !== undefined) {
    if (getTemplate(input.templateId)) {
      filter.templateId = input.templateId;
    } else {
      errors.push(
        `Unknown template '${input.templateId}'. Use \`zealakit info --json\` to list templates.`,
      );
    }
  }

  if (input.recipeId !== undefined) {
    if (getRecipe(input.recipeId)) {
      filter.recipeId = input.recipeId;
    } else {
      errors.push(
        `Unknown recipe '${input.recipeId}'. Use \`zealakit info --json\` to list recipes.`,
      );
    }
  }

  // `discovery: false` is a no-op (profiles are opt-in, never opt-out).
  if (input.discovery === true) {
    filter.discovery = true;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, filter };
}

/** Deterministic key order for the JSON `filters` echo. */
export function orderInfoFilter(filter: InfoFilter): InfoFilter {
  const ordered: InfoFilter = {};
  if (filter.ecosystem) ordered.ecosystem = filter.ecosystem;
  if (filter.scope) ordered.scope = filter.scope;
  if (filter.projectType) ordered.projectType = filter.projectType;
  if (filter.uiFramework) ordered.uiFramework = filter.uiFramework;
  if (filter.capability) ordered.capability = filter.capability;
  if (filter.templateId) ordered.templateId = filter.templateId;
  if (filter.recipeId) ordered.recipeId = filter.recipeId;
  if (filter.category) ordered.category = filter.category;
  if (filter.discovery) ordered.discovery = true;
  return ordered;
}

/** Deterministic string compare (locale-independent; keeps JSON ordering stable). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whether a template's Discovery profile covers `projectType` (unsupported → false). */
export function templateProvidesCapability(
  template: TemplateConfig,
  capability: Capability,
): boolean {
  return Boolean(getTemplateProfile(template.id)?.capabilities.includes(capability));
}

export function recipeProvidesCapability(recipe: RecipeConfig, capability: Capability): boolean {
  return Boolean(getRecipeProfile(recipe.id)?.capabilities.includes(capability));
}

export function templateSupportsProjectType(
  template: TemplateConfig,
  projectType: ProjectType,
): boolean {
  if (!isSupportedProjectType(projectType)) {
    return false;
  }
  const profile = getTemplateProfile(template.id);
  return Boolean(profile?.projectTypes.includes(projectType));
}

/**
 * Whether a recipe's Discovery profile covers `projectType`.
 * An omitted `projectTypes` means "every supported project type".
 */
export function recipeSupportsProjectType(recipe: RecipeConfig, projectType: ProjectType): boolean {
  if (!isSupportedProjectType(projectType)) {
    return false;
  }
  const profile = getRecipeProfile(recipe.id);
  if (!profile) {
    return false;
  }
  return !profile.projectTypes || profile.projectTypes.includes(projectType);
}

/**
 * Hard filter for a registered template. Only reads registry + profiles;
 * compatibility with a recipe/category delegates to `compat.ts`.
 */
export function matchesTemplateFilter(template: TemplateConfig, filter: InfoFilter): boolean {
  if (filter.ecosystem && getTemplateEcosystem(template) !== filter.ecosystem) {
    return false;
  }
  if (filter.scope && template.scope !== filter.scope) {
    return false;
  }
  if (filter.templateId && template.id !== filter.templateId) {
    return false;
  }
  if (filter.uiFramework && template.uiFramework !== filter.uiFramework) {
    return false;
  }
  if (filter.capability && !templateProvidesCapability(template, filter.capability)) {
    return false;
  }

  if (filter.projectType && !templateSupportsProjectType(template, filter.projectType)) {
    return false;
  }

  if (filter.discovery && !getTemplateProfile(template.id)) {
    return false;
  }

  if (filter.recipeId) {
    const recipe = getRecipe(filter.recipeId);
    if (!recipe || checkRecipeCompatibility(recipe, template)) {
      return false;
    }
  }

  if (filter.category) {
    const compatible = getRecipesByCategory(filter.category).some(
      (recipe) => !checkRecipeCompatibility(recipe, template),
    );
    if (!compatible) {
      return false;
    }
  }

  return true;
}

/** Hard filter for a registered recipe; mirrors registry + Discovery profile metadata. */
export function matchesRecipeFilter(recipe: RecipeConfig, filter: InfoFilter): boolean {
  if (filter.ecosystem && getRecipeEcosystem(recipe) !== filter.ecosystem) {
    return false;
  }
  if (filter.scope && !recipeSupportsScope(recipe, filter.scope)) {
    return false;
  }
  if (filter.recipeId && recipe.id !== filter.recipeId) {
    return false;
  }
  if (filter.category && !recipeHasCategory(recipe, filter.category)) {
    return false;
  }
  if (
    filter.uiFramework &&
    recipe.uiFrameworks &&
    !recipe.uiFrameworks.includes(filter.uiFramework)
  ) {
    return false;
  }
  if (filter.capability && !recipeProvidesCapability(recipe, filter.capability)) {
    return false;
  }

  if (filter.templateId) {
    const template = getTemplate(filter.templateId);
    if (!template || checkRecipeCompatibility(recipe, template)) {
      return false;
    }
  }

  if (filter.projectType && !recipeSupportsProjectType(recipe, filter.projectType)) {
    return false;
  }

  if (filter.discovery && !getRecipeProfile(recipe.id)) {
    return false;
  }

  return true;
}
