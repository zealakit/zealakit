/**
 * Public API of `@zealakit/core`.
 *
 * - `@zealakit/core`            this file: the programmatic client, errors, metadata/Discovery API
 * - `@zealakit/core/ecosystem`  what ecosystem packages (Node, Go, …) register against
 * - `@zealakit/core/internal`   everything the CLI and tests reach into; no stability promise
 */
export {
  createZealakit,
  type DiscoveryQuery,
  type EcosystemRegistration,
  type MetadataQuery,
  type ProjectClient,
  type ScaffoldClient,
  type ScaffoldExecutionResult,
  type Zealakit,
  ZealakitApiError,
  type ZealakitOptions,
} from "./client.js";
export {
  type Diagnostic,
  ExitCode,
  formatDiagnostic,
  ScaffoldValidationError,
} from "./diagnostics.js";
export {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  DISCOVERY_OPERATIONS,
  type DiscoveryApiError,
  type DiscoveryApiErrorCode,
  type DiscoveryApiErrorResponse,
  type DiscoveryApiOptions,
  type DiscoveryApiRequest,
  type DiscoveryApiResponse,
  type DiscoveryApiSchemaVersion,
  type DiscoveryApiSuccessResponse,
  type DiscoveryOperation,
  type DiscoveryProjectRequest,
  type DiscoveryQuestionOptionPayload,
  type DiscoveryQuestionPayload,
  type DiscoveryQuestionsData,
  type DiscoveryReasonPayload,
  type DiscoveryRecipeRecommendationPayload,
  type DiscoveryRecommendationsData,
  type DiscoveryScaffoldData,
  type DiscoverySelectionErrorPayload,
  type DiscoveryTemplateRecommendationPayload,
  type DiscoveryValidationData,
  handleDiscoveryRequest,
} from "./discovery/api/index.js";
export type { DiscoveryAnswers } from "./discovery/questionnaire/types.js";
export type {
  EcosystemMetadata,
  InfoFilter,
  RecipeMetadata,
  TemplateMetadata,
} from "./info/index.js";
export type { AddPlan, ApplyAddResult, FileChange } from "./project/add.js";
export type { ProjectCheck, ProjectReport } from "./project/checks.js";
export { ScaffoldCommitError, type ScaffoldCommitErrorDetails } from "./scaffold/commit.js";
export type {
  ManifestFieldConflict,
  NextSteps,
  PackagePlan,
  ScaffoldPlan,
} from "./scaffold/index.js";
export type { PlanCheck, PlannedFile } from "./scaffold/plan.js";
export type {
  EcosystemId,
  RecipeCategory,
  ScaffoldConfig,
  Scope,
  ValidationResult,
} from "./types.js";
export type { OutdatedEntry, OutdatedReport } from "./versions/outdated.js";
