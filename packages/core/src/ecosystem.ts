/** Registration surface for ecosystem packages (Node, Go, …). */
export type { EcosystemRegistration } from "./client.js";
export { adaptRunCommand, installCommand, type PackageManager } from "./package-manager.js";
export { registerRecipe, registerTemplate } from "./registry/catalog.js";
export {
  getNpmManifest,
  getRecipe,
  getTemplate,
  getTemplateDevCommand,
  getTemplateOverlayId,
} from "./registry/index.js";
export { getRecipeAgentEntry } from "./scaffold/agent-docs.js";
export {
  buildDocsProfile,
  copyDocsChecker,
  DOCS_CHECK_SCRIPT,
  DOCS_PROFILE_FILE,
  DOCS_SKILL_DIR,
  type DocsLayout,
  type DocsLinkStyle,
  type DocsProfile,
  type DocsProfileOptions,
  type DocsSectionId,
  type DocsUnit,
  docsCheckCommand,
  docsLayoutForTemplate,
  docsSectionsForRecipes,
  writeDocsProfile,
} from "./scaffold/docs-profile.js";
export {
  type DependencyStatus,
  emptyPackagePlan,
  type ManifestAdapter,
  type ManifestFieldConflict,
  type NextSteps,
  type NextStepsOptions,
  type PackagePlan,
  type PostGenerateOptions,
  type PostGenerateResult,
  type ProjectDependency,
  type ProjectFileMerge,
  setManifestAdapter,
} from "./scaffold/manifest.js";
export { assertStagingRealPath, getRecipeDir, resolveStagingPath } from "./scaffold/paths.js";
export type {
  EcosystemId,
  FinalizeContext,
  GoRecipeManifest,
  NpmRecipeManifest,
  PythonRecipeManifest,
  RecipeConfig,
  RecipeFileTransform,
  RecipeManifest,
  ScaffoldConfig,
  TemplateConfig,
  ValidationResult,
} from "./types.js";
