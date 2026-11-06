import { checkRecipeCompatibility } from "../compat.js";
import {
  ECOSYSTEM_LABELS,
  ECOSYSTEMS,
  PROJECT_TYPES,
  RECIPE_CATEGORIES,
  SCOPES,
  SUPPORTED_PROJECT_TYPES,
  UI_FRAMEWORKS,
} from "../constants.js";
import { resolveRecipeProfile, resolveTemplateProfile } from "../profiles/index.js";
import type { ResolvedRecipeProfile, ResolvedTemplateProfile } from "../profiles/types.js";
import { getStepInitialValue, getStepOptions, STEPS_BY_SCOPE } from "../prompts/steps.js";
import {
  DEFAULT_TEMPLATE_ID,
  getAllRecipeIds,
  getAllTemplateIds,
  getRecipe,
  getRecipeCategories,
  getRecipesByCategory,
  getTemplate,
  getTemplateDevCommand,
  getTemplateOverlayId,
  recipeHasCategory,
  recipeSupportsScope,
  withDefaultRecipes,
} from "../registry/index.js";
import { getRecipeAgentEntry } from "../scaffold/agent-docs.js";
import type { RecipeConfig, RecipeFileTransform, TemplateConfig } from "../types.js";
import {
  compareStrings,
  getRecipeEcosystem,
  getTemplateEcosystem,
  matchesRecipeFilter,
  matchesTemplateFilter,
  orderInfoFilter,
  recipeSupportsProjectType,
  templateSupportsProjectType,
} from "./filters.js";
import { getRuleMetadata } from "./rules.js";
import {
  type EcosystemMetadata,
  INFO_COMMAND,
  INFO_NONE_VALUE,
  INFO_SCHEMA_VERSION,
  type InfoData,
  type InfoFilter,
  type InfoOptions,
  type InfoResponse,
  type ProjectTypeMetadata,
  type PromptStepMetadata,
  type RecipeCategoryMetadata,
  type RecipeMetadata,
  type RuleMetadata,
  type ScopeMetadata,
  type TemplateMetadata,
  type UiFrameworkMetadata,
} from "./types.js";

type SelectionState = {
  templates: TemplateConfig[];
  recipes: RecipeConfig[];
  recipeIds: ReadonlySet<string>;
};

function selectTemplates(filter: InfoFilter): TemplateConfig[] {
  return getAllTemplateIds().flatMap((id) => {
    const template = getTemplate(id);
    return template && matchesTemplateFilter(template, filter) ? [template] : [];
  });
}

function selectRecipes(filter: InfoFilter): RecipeConfig[] {
  return getAllRecipeIds().flatMap((id) => {
    const recipe = getRecipe(id);
    return recipe && matchesRecipeFilter(recipe, filter) ? [recipe] : [];
  });
}

function createState(filter: InfoFilter): SelectionState {
  const recipes = selectRecipes(filter);
  return {
    templates: selectTemplates(filter),
    recipes,
    recipeIds: new Set(recipes.map((recipe) => recipe.id)),
  };
}

// ── Normalization helpers (never expose registry objects by reference) ───────

function sortRecord(input: Record<string, string> | undefined): Record<string, string> {
  if (!input) return {};
  const entries = Object.entries(input).sort(([a], [b]) => compareStrings(a, b));
  return Object.fromEntries(entries);
}

function sortNestedRecord(
  input: Record<string, Record<string, string>> | undefined,
): Record<string, Record<string, string>> {
  if (!input) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const key of Object.keys(input).sort(compareStrings)) {
    out[key] = sortRecord(input[key]);
  }
  return out;
}

function sortTransformedFiles(
  input: Record<string, RecipeFileTransform[]> | undefined,
): Record<string, string[]> {
  if (!input) return {};
  const out: Record<string, string[]> = {};
  for (const key of Object.keys(input).sort(compareStrings)) {
    out[key] = [...new Set((input[key] ?? []).map((transform) => transform.file))];
  }
  return out;
}

function cloneTemplateProfile(profile: ResolvedTemplateProfile): ResolvedTemplateProfile {
  return {
    ...profile,
    projectTypes: [...profile.projectTypes],
    ...(profile.purposes ? { purposes: [...profile.purposes] } : {}),
    ...(profile.frontendModes ? { frontendModes: [...profile.frontendModes] } : {}),
    ...(profile.backend
      ? {
          backend: {
            runtimes: [...profile.backend.runtimes],
            ...(profile.backend.frameworks ? { frameworks: [...profile.backend.frameworks] } : {}),
          },
        }
      : {}),
    capabilities: [...profile.capabilities],
    ...(profile.databases ? { databases: [...profile.databases] } : {}),
    ...(profile.deploymentTargets ? { deploymentTargets: [...profile.deploymentTargets] } : {}),
    ...(profile.architectureLevels ? { architectureLevels: [...profile.architectureLevels] } : {}),
    ...(profile.trafficExpectations
      ? { trafficExpectations: [...profile.trafficExpectations] }
      : {}),
    scopes: [...profile.scopes],
    ...(profile.frontend
      ? {
          frontend: {
            frameworks: [...profile.frontend.frameworks],
            modes: [...profile.frontend.modes],
          },
        }
      : {}),
  };
}

function cloneRecipeProfile(profile: ResolvedRecipeProfile): ResolvedRecipeProfile {
  return {
    ...profile,
    capabilities: [...profile.capabilities],
    ...(profile.projectTypes ? { projectTypes: [...profile.projectTypes] } : {}),
    ...(profile.requires ? { requires: [...profile.requires] } : {}),
    ...(profile.excludes ? { excludes: [...profile.excludes] } : {}),
    ...(profile.databases ? { databases: [...profile.databases] } : {}),
    categories: [...profile.categories],
    scopes: profile.scopes === "all" ? "all" : [...profile.scopes],
    ...(profile.uiFrameworks ? { uiFrameworks: [...profile.uiFrameworks] } : {}),
    dependsOn: [...profile.dependsOn],
    conflicts: [...profile.conflicts],
  };
}

// ── Entity metadata ─────────────────────────────────────────────────────────

function compatibleRecipeIds(template: TemplateConfig, recipeIds: string[]): string[] {
  return recipeIds.filter((id) => {
    const recipe = getRecipe(id);
    return recipe ? checkRecipeCompatibility(recipe, template) === undefined : false;
  });
}

function promptStepsMetadata(
  template: TemplateConfig,
  visibleRecipeIds: ReadonlySet<string>,
): PromptStepMetadata[] {
  return STEPS_BY_SCOPE[template.scope].flatMap((step): PromptStepMetadata[] => {
    const options = getStepOptions(step, template).filter((recipe) =>
      visibleRecipeIds.has(recipe.id),
    );
    if (options.length === 0) {
      return [];
    }
    if (step.kind === "select") {
      return [
        {
          kind: "select",
          category: step.category,
          message: step.message,
          noneLabel: step.noneLabel,
          initialValue: getStepInitialValue(step, options) ?? null,
          options: options.map((recipe) => recipe.id),
          ...(step.notice ? { notice: step.notice } : {}),
        },
      ];
    }
    return [
      {
        kind: "confirm",
        recipeId: step.recipeId,
        message: step.message,
        options: options.map((recipe) => recipe.id),
        ...(step.notice ? { notice: step.notice } : {}),
      },
    ];
  });
}

function buildTemplateMetadata(
  template: TemplateConfig,
  state: SelectionState,
  filter: InfoFilter,
): TemplateMetadata {
  const discovery: ResolvedTemplateProfile | undefined = filter.discovery
    ? resolveTemplateProfile(template.id)
    : undefined;

  return {
    id: template.id,
    name: template.name,
    label: template.label,
    description: template.description,
    scope: template.scope,
    uiFramework: template.uiFramework ?? null,
    ecosystem: getTemplateEcosystem(template),
    path: template.path,
    overlay: getTemplateOverlayId(template.id),
    srcDir: template.srcDir ?? "src",
    devCommand: getTemplateDevCommand(template),
    isDefault: template.id === DEFAULT_TEMPLATE_ID,
    defaultRecipes: withDefaultRecipes(template.scope, []).filter((id) => state.recipeIds.has(id)),
    compatibleRecipes: compatibleRecipeIds(template, [...state.recipeIds]),
    promptSteps: promptStepsMetadata(template, state.recipeIds),
    ...(discovery ? { discovery: cloneTemplateProfile(discovery) } : {}),
  };
}

function conflictsFor(recipe: RecipeConfig, visibleRecipeIds: ReadonlySet<string>): string[] {
  if (!recipe.exclusive) {
    return [];
  }
  const conflicts = new Set<string>();
  for (const category of getRecipeCategories(recipe)) {
    for (const other of getRecipesByCategory(category)) {
      if (other.exclusive && other.id !== recipe.id && visibleRecipeIds.has(other.id)) {
        conflicts.add(other.id);
      }
    }
  }
  return [...conflicts];
}

function buildRecipeMetadata(
  recipe: RecipeConfig,
  state: SelectionState,
  filter: InfoFilter,
): RecipeMetadata {
  const compatibleTemplates: string[] = [];
  const incompatibleTemplates: RecipeMetadata["incompatibleTemplates"] = [];

  for (const template of state.templates) {
    const issue = checkRecipeCompatibility(recipe, template);
    if (issue) {
      incompatibleTemplates.push({ templateId: template.id, ...issue });
    } else {
      compatibleTemplates.push(template.id);
    }
  }

  const discovery: ResolvedRecipeProfile | undefined = filter.discovery
    ? resolveRecipeProfile(recipe.id)
    : undefined;
  const categories = getRecipeCategories(recipe);

  return {
    id: recipe.id,
    name: recipe.name,
    hint: recipe.hint ?? null,
    ecosystem: getRecipeEcosystem(recipe),
    primaryCategory: categories[0] as RecipeMetadata["primaryCategory"],
    categories,
    exclusive: recipe.exclusive ?? false,
    default: recipe.default ?? false,
    dependsOn: [...(recipe.dependsOn ?? [])],
    supportedScopes: recipe.supportedScopes === "all" ? "all" : [...recipe.supportedScopes],
    uiFrameworks: recipe.uiFrameworks ? [...recipe.uiFrameworks] : null,
    templates: compatibleTemplates,
    incompatibleTemplates,
    conflictsWith: conflictsFor(recipe, state.recipeIds),
    packages: sortRecord(recipe.packages),
    devDependencies: sortRecord(recipe.devDependencies),
    overlayPackages: sortNestedRecord(recipe.overlayPackages),
    overlayDevDependencies: sortNestedRecord(recipe.overlayDevDependencies),
    scripts: sortRecord(recipe.scripts),
    transformedFiles: sortTransformedFiles(recipe.fileTransforms),
    hasAgentEntry: getRecipeAgentEntry(recipe.id) !== undefined,
    ...(discovery ? { discovery: cloneRecipeProfile(discovery) } : {}),
  };
}

// ── Vocabulary metadata ─────────────────────────────────────────────────────

function buildEcosystemMetadata(state: SelectionState, filter: InfoFilter): EcosystemMetadata[] {
  const ecosystemIds = filter.ecosystem ? [filter.ecosystem] : [...ECOSYSTEMS];
  return ecosystemIds.map((id) => ({
    id,
    label: ECOSYSTEM_LABELS[id],
    templates: state.templates
      .filter((template) => getTemplateEcosystem(template) === id)
      .map((template) => template.id),
    recipes: state.recipes
      .filter((recipe) => getRecipeEcosystem(recipe) === id)
      .map((recipe) => recipe.id),
  }));
}

function buildScopeMetadata(state: SelectionState, filter: InfoFilter): ScopeMetadata[] {
  const scopeIds = filter.scope ? [filter.scope] : [...SCOPES];
  return scopeIds.map((id) => ({
    id,
    templates: state.templates
      .filter((template) => template.scope === id)
      .map((template) => template.id),
    recipes: state.recipes
      .filter((recipe) => recipeSupportsScope(recipe, id))
      .map((recipe) => recipe.id),
  }));
}

function buildProjectTypeMetadata(
  state: SelectionState,
  filter: InfoFilter,
): ProjectTypeMetadata[] {
  const projectTypes = filter.projectType ? [filter.projectType] : [...PROJECT_TYPES];
  return projectTypes.map((id) => ({
    id,
    supported: (SUPPORTED_PROJECT_TYPES as readonly string[]).includes(id),
    templates: state.templates
      .filter((template) => templateSupportsProjectType(template, id))
      .map((template) => template.id),
    recipes: state.recipes
      .filter((recipe) => recipeSupportsProjectType(recipe, id))
      .map((recipe) => recipe.id),
  }));
}

function buildUiFrameworkMetadata(
  state: SelectionState,
  filter: InfoFilter,
): UiFrameworkMetadata[] {
  const frameworks = filter.uiFramework ? [filter.uiFramework] : [...UI_FRAMEWORKS];
  return frameworks.map((id) => ({
    id,
    templates: state.templates
      .filter((template) => template.uiFramework === id)
      .map((template) => template.id),
    recipes: state.recipes
      .filter((recipe) => recipe.uiFrameworks?.includes(id))
      .map((recipe) => recipe.id),
  }));
}

function buildCategoryMetadata(
  state: SelectionState,
  filter: InfoFilter,
): RecipeCategoryMetadata[] {
  const categories = filter.category ? [filter.category] : [...RECIPE_CATEGORIES];
  return categories.map((id) => {
    const members = state.recipes.filter((recipe) => recipeHasCategory(recipe, id));
    const exclusiveRecipes = members
      .filter((recipe) => recipe.exclusive)
      .map((recipe) => recipe.id);
    const defaultRecipes = members.filter((recipe) => recipe.default).map((recipe) => recipe.id);
    return {
      id,
      exclusive: exclusiveRecipes.length > 0,
      required: false,
      auto: defaultRecipes.length > 0,
      recipes: members.map((recipe) => recipe.id),
      exclusiveRecipes,
      nonExclusiveRecipes: members.filter((recipe) => !recipe.exclusive).map((recipe) => recipe.id),
      defaultRecipes,
    };
  });
}

// ── Public queries ──────────────────────────────────────────────────────────

/** Registered template ids (registry order), after applying `filter`. */
export function getTemplateIds(filter: InfoFilter = {}): string[] {
  return selectTemplates(filter).map((template) => template.id);
}

/** Registered recipe ids (registration order), after applying `filter`. */
export function getRecipeIds(filter: InfoFilter = {}): string[] {
  return selectRecipes(filter).map((recipe) => recipe.id);
}

/** Normalized template metadata (no registry objects exposed). */
export function getTemplateMetadata(filter: InfoFilter = {}): TemplateMetadata[] {
  const state = createState(filter);
  return state.templates.map((template) => buildTemplateMetadata(template, state, filter));
}

/** Normalized recipe metadata (no registry objects exposed). */
export function getRecipeMetadata(filter: InfoFilter = {}): RecipeMetadata[] {
  const state = createState(filter);
  return state.recipes.map((recipe) => buildRecipeMetadata(recipe, state, filter));
}

export function getEcosystemMetadata(filter: InfoFilter = {}): EcosystemMetadata[] {
  return buildEcosystemMetadata(createState(filter), filter);
}

export function getScopeMetadata(filter: InfoFilter = {}): ScopeMetadata[] {
  return buildScopeMetadata(createState(filter), filter);
}

export function getProjectTypeMetadata(filter: InfoFilter = {}): ProjectTypeMetadata[] {
  return buildProjectTypeMetadata(createState(filter), filter);
}

export function getUiFrameworkMetadata(filter: InfoFilter = {}): UiFrameworkMetadata[] {
  return buildUiFrameworkMetadata(createState(filter), filter);
}

export function getRecipeCategoryMetadata(filter: InfoFilter = {}): RecipeCategoryMetadata[] {
  return buildCategoryMetadata(createState(filter), filter);
}

export function getInfoRules(filter: InfoFilter = {}): RuleMetadata[] {
  return getRuleMetadata(new Set(getRecipeIds(filter)));
}

/**
 * Shared metadata snapshot. This is the single entry point for `zealakit info`,
 * Discovery-adjacent tooling, and external JSON consumers.
 *
 * All keys are always present; filtered sections become empty arrays. Relation
 * ids (compatible recipes, template lists, category members, rule recipes) are
 * restricted to the filtered set so the response never references hidden ids.
 */
export function getInfo(filter: InfoFilter = {}, options: InfoOptions = {}): InfoResponse {
  const state = createState(filter);
  const effectiveFilter = orderInfoFilter(filter);

  const data: InfoData = {
    ...(options.cli ? { cli: options.cli } : {}),
    defaults: { templateId: DEFAULT_TEMPLATE_ID, noneValue: INFO_NONE_VALUE },
    ecosystems: buildEcosystemMetadata(state, effectiveFilter),
    scopes: buildScopeMetadata(state, effectiveFilter),
    projectTypes: buildProjectTypeMetadata(state, effectiveFilter),
    uiFrameworks: buildUiFrameworkMetadata(state, effectiveFilter),
    categories: buildCategoryMetadata(state, effectiveFilter),
    templates: state.templates.map((template) =>
      buildTemplateMetadata(template, state, effectiveFilter),
    ),
    recipes: state.recipes.map((recipe) => buildRecipeMetadata(recipe, state, effectiveFilter)),
    rules: getRuleMetadata(state.recipeIds),
  };

  return {
    schemaVersion: INFO_SCHEMA_VERSION,
    command: INFO_COMMAND,
    filters: effectiveFilter,
    data,
  };
}
