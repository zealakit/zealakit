import type { IncompatibilityCode } from "../compat.js";
import type { EcosystemId, ProjectType, RecipeCategory, Scope, UiFramework } from "../constants.js";
import type { ResolvedRecipeProfile, ResolvedTemplateProfile } from "../profiles/types.js";

/**
 * Public metadata contract for `zealakit info` / `getInfo()`.
 *
 * Bump `INFO_SCHEMA_VERSION` when a field is renamed, removed, or changes
 * meaning. Adding new optional fields is backwards compatible within a version.
 *
 * Version history:
 * - 3: flat `KitInfo` (`templates`, `recipes`, `categories`, `rules`, `cli`, `defaults`).
 * - 4: `{ schemaVersion, command, filters, data }` envelope; adds ecosystems,
 *      project types, typed discovery profiles, and query filters.
 */
export const INFO_SCHEMA_VERSION = 4 as const;

export type InfoSchemaVersion = typeof INFO_SCHEMA_VERSION;

/** Prompt sentinel for "none" (`SelectStep.noneLabel`); part of the JSON contract. */
export const INFO_NONE_VALUE = "none" as const;

export const INFO_COMMAND = "info" as const;

export type CliUsageMetadata = {
  create: string;
  discover: string;
  scaffold: string;
  dryRun: string;
  info: string;
};

/** Metadata read from the host CLI `package.json` (supplied by the CLI, not core). */
export type CliMetadata = {
  name: string;
  bin: string;
  version: string;
  description: string | null;
  homepage: string | null;
  engines: Record<string, string>;
  usage: CliUsageMetadata;
};

export type EcosystemMetadata = {
  id: EcosystemId;
  label: string;
  /** Registered template ids owned by this ecosystem (after filters). */
  templates: string[];
  /** Registered recipe ids owned by this ecosystem (after filters). */
  recipes: string[];
};

export type ScopeMetadata = {
  id: Scope;
  templates: string[];
  recipes: string[];
};

export type ProjectTypeMetadata = {
  id: ProjectType;
  /** Whether a Discovery questionnaire + matching path exists for this type. */
  supported: boolean;
  templates: string[];
  recipes: string[];
};

export type UiFrameworkMetadata = {
  id: UiFramework;
  templates: string[];
  /** Recipes that explicitly target this framework (agnostic recipes are omitted). */
  recipes: string[];
};

export type RecipeCategoryMetadata = {
  id: RecipeCategory;
  /** At most one of `exclusiveRecipes` may be selected. */
  exclusive: boolean;
  /** Reserved for required-choice categories; currently always `false`. */
  required: boolean;
  /** Contains recipes injected automatically (`defaultRecipes`). */
  auto: boolean;
  recipes: string[];
  exclusiveRecipes: string[];
  nonExclusiveRecipes: string[];
  defaultRecipes: string[];
};

export type SelectPromptStepMetadata = {
  kind: "select";
  category: RecipeCategory;
  message: string;
  noneLabel: string;
  /** Preselected recipe id; `null` = "none" */
  initialValue: string | null;
  options: string[];
  notice?: string;
};

export type ConfirmPromptStepMetadata = {
  kind: "confirm";
  recipeId: string;
  message: string;
  options: string[];
  notice?: string;
};

export type PromptStepMetadata = SelectPromptStepMetadata | ConfirmPromptStepMetadata;

export type TemplateMetadata = {
  id: string;
  name: string;
  label: string;
  description: string;
  scope: Scope;
  /** `null` for server / infrastructure templates. */
  uiFramework: UiFramework | null;
  ecosystem: EcosystemId;
  /** Registry-relative template path (`node/<id>`); part of the v3 contract. */
  path: string;
  overlay: string;
  srcDir: string;
  devCommand: string;
  isDefault: boolean;
  /** Defaults injected for this template (restricted to visible recipes). */
  defaultRecipes: string[];
  /** Compatible recipes (restricted to visible recipes). */
  compatibleRecipes: string[];
  promptSteps: PromptStepMetadata[];
  /**
   * Authored ResolvedTemplateProfile, present only when Discovery metadata was
   * requested (`discovery: true` / `--discover`). Read-only snapshot.
   */
  discovery?: ResolvedTemplateProfile;
};

export type IncompatibleTemplateMetadata = {
  templateId: string;
  code: IncompatibilityCode;
  message: string;
};

export type RecipeMetadata = {
  id: string;
  name: string;
  hint: string | null;
  ecosystem: EcosystemId;
  primaryCategory: RecipeCategory;
  categories: RecipeCategory[];
  exclusive: boolean;
  default: boolean;
  dependsOn: string[];
  supportedScopes: Scope[] | "all";
  /** `null` = framework-agnostic. */
  uiFrameworks: UiFramework[] | null;
  /** Templates this recipe can be applied to (restricted to visible templates). */
  templates: string[];
  incompatibleTemplates: IncompatibleTemplateMetadata[];
  /** Recipes that cannot be selected together with this one (visible only). */
  conflictsWith: string[];
  packages: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Keyed by overlay id; keys and package names are sorted for stable output. */
  overlayPackages: Record<string, Record<string, string>>;
  overlayDevDependencies: Record<string, Record<string, string>>;
  scripts: Record<string, string>;
  /** Keyed by template or overlay id, sorted; values are unique file paths. */
  transformedFiles: Record<string, string[]>;
  hasAgentEntry: boolean;
  /**
   * Derived ResolvedRecipeProfile, present only when Discovery metadata was
   * requested (`discovery: true` / `--discover`). Read-only snapshot.
   */
  discovery?: ResolvedRecipeProfile;
};

export type RuleMetadata = {
  id: string;
  description: string;
  /** Recipe ids the rule applies to (restricted to visible recipes). */
  recipes?: string[];
};

export type InfoDefaults = {
  templateId: string;
  noneValue: typeof INFO_NONE_VALUE;
};

/**
 * Typed, already-validated metadata filter. All fields are optional and combine
 * with AND semantics; invalid values never reach this type.
 */
export type InfoFilter = {
  ecosystem?: EcosystemId;
  scope?: Scope;
  projectType?: ProjectType;
  uiFramework?: UiFramework;
  templateId?: string;
  recipeId?: string;
  category?: RecipeCategory;
  /** Include Discovery profiles and keep only entities that have one. */
  discovery?: boolean;
};

/** Raw (string) filter input, typically from CLI flags. */
export type InfoFilterInput = {
  ecosystem?: string;
  scope?: string;
  projectType?: string;
  uiFramework?: string;
  templateId?: string;
  recipeId?: string;
  category?: string;
  discovery?: boolean;
};

export type NormalizeInfoFilterResult =
  | { ok: true; filter: InfoFilter }
  | { ok: false; errors: string[] };

export type InfoData = {
  /** Present when the caller supplied CLI metadata (the `zealakit` CLI always does). */
  cli?: CliMetadata;
  defaults: InfoDefaults;
  ecosystems: EcosystemMetadata[];
  scopes: ScopeMetadata[];
  projectTypes: ProjectTypeMetadata[];
  uiFrameworks: UiFrameworkMetadata[];
  categories: RecipeCategoryMetadata[];
  templates: TemplateMetadata[];
  recipes: RecipeMetadata[];
  rules: RuleMetadata[];
};

export type InfoResponse = {
  schemaVersion: InfoSchemaVersion;
  command: typeof INFO_COMMAND;
  /** Echoes the applied filter (only defined keys, stable order). */
  filters: InfoFilter;
  data: InfoData;
};

export type InfoErrorResponse = {
  schemaVersion: InfoSchemaVersion;
  command: typeof INFO_COMMAND;
  error: {
    code: "invalid-filter";
    message: string;
    details: string[];
  };
};

export type InfoOptions = {
  /** CLI/package metadata; core never reads the root package.json itself. */
  cli?: CliMetadata;
};
