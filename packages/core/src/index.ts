export {
  checkRecipeCompatibility,
  getCompatibleRecipes,
  getConflictingRecipes,
  getRecipeIncompatibility,
  type Incompatibility,
  type IncompatibilityCode,
  isRecipeCompatible,
  suggestAlternatives,
} from "./compat.js";
export { FRAMEWORKS, RECIPE_CATEGORIES, SCOPES } from "./constants.js";
export {
  circularDependencyDiagnostic,
  type Diagnostic,
  ExitCode,
  fail,
  failDiagnostic,
  formatDiagnostic,
  incompatDiagnostic,
  missingDependencyDiagnostic,
  printError,
  printInfo,
  printWarning,
  recipeConflictDiagnostic,
  unknownRecipesDiagnostic,
  unknownTemplateDiagnostic,
} from "./diagnostics.js";
export { HYBRID_ORM_WARNING, hybridOrmSelections } from "./orm-warnings.js";
export {
  clearRegistry,
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
  recipes,
  registerRecipe,
  registerTemplate,
  templates,
  withDefaultRecipes,
} from "./registry/index.js";
export {
  formatRecipeResolveError,
  resolveRecipeDependencies,
} from "./resolve-recipes.js";
export {
  applyAgentEntry,
  ensureCursorAgentsSymlink,
  getRecipeAgentEntry,
  insertAgentEntry,
} from "./scaffold/agent-docs.js";
export { copyRecipe, copyTemplate, foldIntoSrcDir, PACKED_DOTFILES } from "./scaffold/copy.js";
export {
  buildScaffoldPlan,
  emptyPackagePlan,
  getManifestAdapter,
  getManifestAdapterForConfig,
  type ManifestAdapter,
  type ManifestFieldConflict,
  type PackagePlan,
  planIsReady,
  resolveTemplateEcosystem,
  type ScaffoldPlan,
  scaffoldProject,
  setManifestAdapter,
  validateGeneratedOutput,
} from "./scaffold/index.js";
export {
  getRecipeDir,
  getTemplateDir,
  type OverlayResolution,
  PACKAGE_ROOT,
  RECIPES_DIR,
  resolveRecipeOverlay,
  TEMPLATES_DIR,
} from "./scaffold/paths.js";
export {
  applyFileTransforms,
  getRecipeTransforms,
  transformSource,
} from "./scaffold/transforms.js";
export type {
  CliOptions,
  EcosystemId,
  Framework,
  RecipeCategory,
  RecipeConfig,
  RecipeFileTransform,
  ScaffoldConfig,
  Scope,
  TemplateConfig,
  ValidationResult,
} from "./types.js";
export {
  directoryHasFiles,
  printValidationErrors,
  validateProjectName,
  validateRecipeCompatibility,
  validateRecipeConflicts,
  validateRecipeIds,
  validateScaffoldConfig,
  validateScaffoldInput,
  validateTargetDirectory,
  validateTemplate,
} from "./validation/index.js";
