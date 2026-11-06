import type {
  ApiTrafficExpectation,
  ArchitectureLevel,
  BackendFramework,
  BackendRuntime,
  Capability,
  DatabaseType,
  DeploymentTarget,
  FrontendDelivery,
  FrontendMode,
  ProjectPurpose,
  ProjectType,
  RecipeCategory,
  Scope,
  UiFramework,
} from "../constants.js";
import type { EcosystemId } from "../types.js";

/**
 * Discovery metadata for a template.
 *
 * Semantics:
 * - `id` must match a registered template.
 * - Omitted optional fields mean "not applicable / not claimed" — never "unknown".
 * - Do not use empty arrays to mean unrestricted or unknown; omit the field instead.
 * - Scope, UI framework, and ecosystem are not authored here; they come from `TemplateConfig`.
 */
export type TemplateProfile = {
  id: string;
  projectTypes: ProjectType[];
  purposes?: ProjectPurpose[];
  /** Present when the template ships a web UI; frameworks come from `TemplateConfig.uiFramework`. */
  frontendModes?: FrontendMode[];
  /** Meta-framework / delivery stack when distinct from `uiFramework` alone. */
  delivery?: FrontendDelivery;
  backend?: {
    runtimes: BackendRuntime[];
    /** Omit when the stack is not one of `BACKEND_FRAMEWORKS` (e.g. Astro Node adapter). */
    frameworks?: BackendFramework[];
  };
  capabilities: Capability[];
  databases?: DatabaseType[];
  deploymentTargets?: DeploymentTarget[];
  architectureLevels?: ArchitectureLevel[];
  /**
   * Soft traffic/concurrency levels this template is a strong fit for.
   * Ranking only — not a hard gate and not a performance benchmark claim.
   */
  trafficExpectations?: ApiTrafficExpectation[];
};

/**
 * Discovery metadata authored for a recipe.
 *
 * Category, scopes, UI frameworks, `dependsOn`, and exclusive conflicts are
 * owned by `RecipeConfig` / compat — do not duplicate them here.
 *
 * Semantics:
 * - `capabilities` is what the recipe *adds* (may be empty for tooling-only recipes).
 * - `requires` / `excludes` are capability gates for future matching (omit when unused).
 * - `alwaysRelevant` marks tooling that every compatible project should see in
 *   Discovery (linters/formatters); it never overrides compatibility.
 * - Omitted optional fields mean not applicable.
 */
export type RecipeProfile = {
  id: string;
  capabilities: Capability[];
  projectTypes?: ProjectType[];
  requires?: Capability[];
  excludes?: Capability[];
  databases?: DatabaseType[];
  /** Tooling recipe offered to every compatible project (relevance only). */
  alwaysRelevant?: boolean;
};

/** Template profile merged with live registry fields. */
export type ResolvedTemplateProfile = TemplateProfile & {
  scope: Scope;
  scopes: Scope[];
  uiFramework?: UiFramework;
  ecosystem: EcosystemId;
  frontend?: {
    frameworks: UiFramework[];
    modes: FrontendMode[];
  };
};

/** Recipe profile merged with live registry + derived exclusivity conflicts. */
export type ResolvedRecipeProfile = RecipeProfile & {
  categories: RecipeCategory[];
  scopes: Scope[] | "all";
  uiFrameworks?: UiFramework[];
  dependsOn: string[];
  conflicts: string[];
  /** Registry `exclusive` flag: at most one exclusive recipe per category. */
  exclusive: boolean;
};
