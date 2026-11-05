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
} from "../../constants.js";

/** Sentinel for optional single-select "no preference" answers. */
export const NO_PREFERENCE = "no-preference" as const;
export type NoPreference = typeof NO_PREFERENCE;

export type DiscoveryQuestionType = "single-select" | "multi-select";

export type DiscoveryOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
};

/**
 * Partial answers collected while walking the questionnaire.
 * Omitted keys / `NO_PREFERENCE` mean unanswered optional prefs.
 */
export type DiscoveryAnswers = {
  projectType?: ProjectType;
  purpose?: ProjectPurpose | NoPreference;
  scopes?: Scope[];
  frontendFramework?: UiFramework | NoPreference;
  frontendMode?: FrontendMode | NoPreference;
  backendRuntime?: BackendRuntime | NoPreference;
  backendFramework?: BackendFramework | NoPreference;
  capabilities?: Capability[];
  databases?: DatabaseType[];
  deploymentTarget?: DeploymentTarget | NoPreference;
  architectureLevel?: ArchitectureLevel | NoPreference;
};

export type DiscoveryQuestionId = keyof DiscoveryAnswers;

export type DiscoveryQuestion = {
  id: DiscoveryQuestionId;
  prompt: string;
  description?: string;
  type: DiscoveryQuestionType;
  required: boolean;
  /** Base options; runtime filtering may narrow them. */
  options: DiscoveryOption[];
  allowNoPreference?: boolean;
  condition?: (answers: DiscoveryAnswers) => boolean;
};
