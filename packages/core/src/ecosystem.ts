/** Registration surface for ecosystem packages (Node, Go, …). */
export type { EcosystemRegistration } from "./client.js";
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
  emptyPackagePlan,
  type ManifestAdapter,
  type ManifestFieldConflict,
  type NextSteps,
  type PackagePlan,
  setManifestAdapter,
} from "./scaffold/manifest.js";
export { assertStagingRealPath, getRecipeDir, resolveStagingPath } from "./scaffold/paths.js";
export type {
  EcosystemId,
  GoRecipeManifest,
  NpmRecipeManifest,
  RecipeConfig,
  RecipeFileTransform,
  RecipeManifest,
  ScaffoldConfig,
  TemplateConfig,
  ValidationResult,
} from "./types.js";
