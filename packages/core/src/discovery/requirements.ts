import type {
  ArchitectureLevel,
  BackendFramework,
  BackendRuntime,
  Capability,
  DatabaseType,
  DeploymentTarget,
  FrontendMode,
  ProjectPurpose,
  ProjectType,
  Scope,
  UiFramework,
} from "../constants.js";

/**
 * Normalized Discovery input (questionnaire output).
 *
 * Semantics:
 * - Omitted optional fields = unanswered / no preference (not hard constraints).
 * - `capabilities` lists capabilities the project needs.
 * - Empty `scopes` = no scope preference.
 */
export type ProjectRequirements = {
  projectType: ProjectType;
  purpose?: ProjectPurpose;
  scopes: Scope[];
  frontend?: {
    framework?: UiFramework;
    mode?: FrontendMode;
  };
  backend?: {
    runtime?: BackendRuntime;
    framework?: BackendFramework;
  };
  capabilities: Capability[];
  databases?: DatabaseType[];
  deploymentTarget?: DeploymentTarget;
  architectureLevel?: ArchitectureLevel;
};

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
export function impliedCapabilities(projectType: ProjectType): Capability[] {
  switch (projectType) {
    case "website":
    case "web-app":
      return ["web-ui"];
    case "api":
      return ["http-api"];
    case "worker":
      return ["background-processing"];
    case "fullstack":
      return ["web-ui", "http-api"];
    case "unknown":
      return [];
  }
}

/** Union of explicit + implied required capabilities (deduped). */
export function requiredCapabilities(requirements: ProjectRequirements): Capability[] {
  return [
    ...new Set([...impliedCapabilities(requirements.projectType), ...requirements.capabilities]),
  ];
}
