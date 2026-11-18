export {
  checkRecipeCompatibility,
  getCompatibleRecipes,
  getConflictingRecipes,
  getRecipeIncompatibility,
  isRecipeCompatible,
  suggestAlternatives,
} from "./compat.js";
export {
  API_TRAFFIC_EXPECTATIONS,
  type BackendFramework,
  type BackendRuntime,
  CAPABILITIES,
  DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE,
  ECOSYSTEMS,
  PROJECT_TYPES,
  RECIPE_CATEGORIES,
  SCOPES,
  UI_FRAMEWORKS,
} from "./constants.js";
export {
  type Diagnostic,
  ExitCode,
  formatDiagnostic,
  recipeConflictDiagnostic,
  ScaffoldValidationError,
  unknownTemplateDiagnostic,
} from "./diagnostics.js";
export {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiErrorCode,
  type DiscoveryApiErrorResponse,
  type DiscoveryApiResponse,
  type DiscoveryQuestionsData,
  type DiscoveryRecommendationsData,
  type DiscoveryScaffoldData,
  type DiscoveryValidationData,
  handleDiscoveryRequest,
} from "./discovery/api/index.js";
export {
  buildDiscoverySessionRecord,
  clearDiscoveryFeedbackSessions,
  computeDiscoveryFeedbackStats,
  createProjectNaming,
  DISCOVERY_FEEDBACK_MAX_SESSIONS,
  DISCOVERY_QUESTIONS,
  type DiscoveryAnswers,
  type DiscoveryQuestion,
  type DiscoveryResult,
  type DiscoverySessionDraft,
  type DiscoverySessionRecord,
  didChangeDiscoveryRecommendations,
  formatDiscoveryFeedbackStats,
  formatDiscoveryFeedbackStatus,
  formatNoCompatibleTemplateMessage,
  formatUnsupportedProjectTypeMessage,
  getDiscoveryFeedbackStats,
  getDiscoveryFeedbackStatus,
  getQuestionOptions,
  getTemplateMatchDiagnostics,
  getVisibleQuestions,
  isDiscoveryFeedbackEnabled,
  loadDiscoveryFeedbackStore,
  matchDiscovery,
  NO_PREFERENCE,
  normalizeDiscoveryAnswers,
  type ProjectNaming,
  type ProjectRequirements,
  parseDiscoveryFeedbackStore,
  pruneDiscoveryAnswers,
  type RecipeMatchResult,
  recordDiscoverySession,
  resolveDiscoveryRequirements,
  saveDiscoveryFeedbackStore,
  setDiscoveryFeedbackEnabled,
  TEMPLATE_SCORE_WEIGHTS,
  type TemplateMatchResult,
  trimDiscoverySessions,
  validateDiscoveryAnswers,
} from "./discovery/index.js";
export {
  type CliMetadata,
  getCapabilityMetadata,
  getEcosystemMetadata,
  getInfo,
  getProjectTypeMetadata,
  getRecipeCategoryMetadata,
  getRecipeIds,
  getRecipeMetadata,
  getScopeMetadata,
  getTemplateIds,
  getTemplateMetadata,
  getUiFrameworkMetadata,
  INFO_COMMAND,
  INFO_SCHEMA_VERSION,
  type InfoFilterInput,
  type InfoResponse,
  type InfoSchemaVersion,
  type MetadataQueryResult,
  normalizeInfoFilter,
  queryMetadata,
} from "./info/index.js";
export { HYBRID_ORM_WARNING, hybridOrmSelections } from "./orm-warnings.js";
export {
  adaptRunCommand,
  detectPackageManager,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
} from "./package-manager.js";
export {
  getAllRecipeProfiles,
  getAllTemplateProfiles,
  getRecipeProfile,
  getTemplateProfile,
  type RecipeProfile,
  resolveRecipeProfile,
  resolveTemplateProfile,
  type TemplateProfile,
  validateProfiles,
} from "./profiles/index.js";
export {
  type AddPlan,
  applyAddPlan,
  planAddRecipes,
} from "./project/add.js";
export {
  checkProject,
  compareKitVersions,
  type ProjectReport,
} from "./project/checks.js";
export { unifiedDiff } from "./project/diff.js";
export {
  buildProjectManifest,
  parseProjectManifest,
  readProjectManifest,
} from "./project-manifest.js";
export {
  getStepInitialValue,
  getStepOptions,
  type PromptStep,
  STEPS_BY_SCOPE,
} from "./prompts/steps.js";
export {
  clearRegistry,
  DEFAULT_TEMPLATE_ID,
  getAllRecipeIds,
  getAllRecipes,
  getAllTemplateIds,
  getAllTemplates,
  getNpmManifest,
  getRecipe,
  getRecipeCategories,
  getTemplate,
  getTemplateOverlayId,
  recipeSupportsScope,
  registerRecipe,
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
export { PACKED_DOTFILES } from "./scaffold/copy.js";
export {
  buildScaffoldPlan,
  executeScaffoldPlan,
  getManifestAdapter,
  getManifestAdapterForConfig,
  type ManifestAdapter,
  planIsReady,
  type ScaffoldPlan,
  scaffoldProject,
  setManifestAdapter,
  validateGeneratedOutput,
} from "./scaffold/index.js";
export type { PostGenerateResult } from "./scaffold/manifest.js";
export {
  assertStagingRealPath,
  assertStagingSymlinksSafe,
  getRecipeDir,
  getTemplateDir,
  isPathInsideRoot,
  PACKAGE_ROOT,
  resolveStagingPath,
} from "./scaffold/paths.js";
export {
  applyFileTransforms,
  getRecipeTransforms,
  transformSource,
} from "./scaffold/transforms.js";
export type {
  RecipeConfig,
  ScaffoldConfig,
  Scope,
  TemplateConfig,
  ValidationResult,
} from "./types.js";
export {
  checkTargetDirectory,
  nonEmptyTargetMessage,
  type OverwritePolicy,
  validateRecipeConflicts,
  validateRecipeIds,
  validateScaffoldConfig,
  validateTemplate,
} from "./validation/index.js";
export {
  computeOutdated,
  type OutdatedReport,
} from "./versions/outdated.js";
