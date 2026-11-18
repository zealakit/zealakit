/**
 * `zealakit/api` — the published programmatic API.
 *
 * No prompts, no `process.exit`, no terminal output: safe to use from servers,
 * scripts, editors and MCP servers.
 */
export {
  createZealakit,
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryAnswers,
  type DiscoveryApiErrorCode,
  type DiscoveryQuery,
  type EcosystemId,
  type EcosystemMetadata,
  type EcosystemRegistration,
  ExitCode,
  type InfoFilter,
  type MetadataQuery,
  type ProjectClient,
  type RecipeMetadata,
  type ScaffoldClient,
  ScaffoldCommitError,
  type ScaffoldConfig,
  type ScaffoldExecutionResult,
  type ScaffoldPlan,
  ScaffoldValidationError,
  type TemplateMetadata,
  type ValidationResult,
  type Zealakit,
  ZealakitApiError,
  type ZealakitOptions,
} from "../../../packages/core/src/index.js";

import type { EcosystemRegistration } from "../../../packages/core/src/index.js";
import { goEcosystem as goRegistration } from "../../../packages/ecosystem-go/src/index.js";
import { nodeEcosystem as nodeRegistration } from "../../../packages/ecosystem-node/src/index.js";

// Typed through core so the emitted declarations do not depend on ecosystem internals.
export const nodeEcosystem: EcosystemRegistration = nodeRegistration;
export const goEcosystem: EcosystemRegistration = goRegistration;
