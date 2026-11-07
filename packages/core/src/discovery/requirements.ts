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
  ProcessingModel,
  ProjectPurpose,
  ProjectType,
  RecipeInterest,
  Scope,
  ServiceType,
  SupportedProjectType,
  UiFramework,
} from "../constants.js";
import { isSupportedProjectType, SUPPORTED_SERVICE_TYPES } from "../constants.js";

type RequirementsBase = {
  scopes: Scope[];
  capabilities: Capability[];
  databases?: DatabaseType[];
  purpose?: ProjectPurpose;
  architectureLevel?: ArchitectureLevel;
  deploymentTarget?: DeploymentTarget;
  /** Soft recipe category preferences from optional questionnaire steps. */
  recipeInterests?: RecipeInterest[];
};

export type UiFrontendRequirements = {
  framework?: UiFramework;
  /**
   * Hard rendering requirement (explicit only).
   * Templates that do not support this mode are ineligible.
   */
  mode?: FrontendMode;
  /**
   * Soft ranking preference inferred from product intent.
   * Never excludes candidates — used only for scoring explanations.
   */
  preferredMode?: FrontendMode;
  /** Meta-framework when distinct from the component library (e.g. Astro). */
  delivery?: FrontendDelivery;
};

export type BackendRequirements = {
  runtime?: BackendRuntime;
  framework?: BackendFramework;
};

export type UiRequirements = RequirementsBase & {
  projectType: "ui";
  frontend?: UiFrontendRequirements;
  /**
   * UI consumes an external API. Does **not** imply generating a backend template.
   * Distinct from capability `"database"`.
   */
  externalApi?: boolean;
};

export type ServerApiRequirements = RequirementsBase & {
  projectType: "server-api";
  serviceType?: ServiceType;
  backend?: BackendRequirements;
  /** Present when the user answered the database gate. */
  databaseKind?: "sql" | "nosql";
  /**
   * Soft ranking signal for expected request volume / concurrency.
   * Omitted when unanswered or "not sure".
   */
  trafficExpectation?: ApiTrafficExpectation;
};

export type WorkerRequirements = RequirementsBase & {
  projectType: "background-worker";
  processingModel?: ProcessingModel;
  backend?: BackendRequirements;
  /** Present when the user answered the database gate. */
  databaseKind?: "sql" | "nosql";
};

/**
 * Normalized Discovery input (questionnaire output).
 * Discriminated by `projectType`. Unsupported root types never appear here.
 */
export type ProjectRequirements = UiRequirements | ServerApiRequirements | WorkerRequirements;

/** Capabilities templates must provide themselves (recipes cannot fill these gaps). */
export const TEMPLATE_OWNED_CAPABILITIES = [
  "web-ui",
  "http-api",
  "background-processing",
] as const satisfies readonly Capability[];

export type TemplateOwnedCapability = (typeof TEMPLATE_OWNED_CAPABILITIES)[number];

export function isTemplateOwnedCapability(capability: Capability): boolean {
  return (TEMPLATE_OWNED_CAPABILITIES as readonly Capability[]).includes(capability);
}

/** Capabilities implied by project type when the questionnaire leaves them implicit. */
export function impliedCapabilities(projectType: SupportedProjectType): Capability[] {
  switch (projectType) {
    case "ui":
      return ["web-ui"];
    case "server-api":
      return ["http-api"];
    case "background-worker":
      return ["background-processing"];
  }
}

/** Union of explicit + implied required capabilities (deduped). */
export function requiredCapabilities(requirements: ProjectRequirements): Capability[] {
  const caps = [...impliedCapabilities(requirements.projectType), ...requirements.capabilities];
  if (requirements.projectType === "ui" && requirements.externalApi) {
    caps.push("external-api");
  }
  // Database preference implies a data-integration need even if not listed in capabilities.
  if (requirements.databases && requirements.databases.length > 0) {
    caps.push("database");
  }
  return [...new Set(caps)];
}

/**
 * Whether database/data-integration is required.
 * Frontend-only templates cannot satisfy this.
 */
export function requiresDataIntegration(requirements: ProjectRequirements): boolean {
  return (
    requirements.capabilities.includes("database") ||
    Boolean(requirements.databases && requirements.databases.length > 0)
  );
}

export function getRequirementsFrontend(
  requirements: ProjectRequirements,
): UiFrontendRequirements | undefined {
  return requirements.projectType === "ui" ? requirements.frontend : undefined;
}

export function getRequirementsBackend(
  requirements: ProjectRequirements,
): BackendRequirements | undefined {
  if (
    requirements.projectType === "server-api" ||
    requirements.projectType === "background-worker"
  ) {
    return requirements.backend;
  }
  return undefined;
}

export function isServiceTypeSupported(serviceType: ServiceType | undefined): boolean {
  if (!serviceType) return true;
  return (SUPPORTED_SERVICE_TYPES as readonly ServiceType[]).includes(serviceType);
}

export function assertSupportedProjectType(
  projectType: ProjectType,
): projectType is SupportedProjectType {
  return isSupportedProjectType(projectType);
}
