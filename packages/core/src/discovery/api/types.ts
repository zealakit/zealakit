import type { RecipeMatchRole } from "../matching/types.js";
import type {
  DiscoveryAnswers,
  DiscoveryQuestionId,
  DiscoveryQuestionType,
} from "../questionnaire/types.js";
import type { ProjectRequirements } from "../requirements.js";

/** Version of the stateless Discovery JSON contract. */
export const DISCOVERY_API_SCHEMA_VERSION = 1 as const;

export type DiscoveryApiSchemaVersion = typeof DISCOVERY_API_SCHEMA_VERSION;

export const DISCOVERY_OPERATIONS = [
  "questions",
  "recommendations",
  "validate",
  "scaffold",
] as const;

export type DiscoveryOperation = (typeof DISCOVERY_OPERATIONS)[number];

/** Stable machine-readable error codes (never parse messages). */
export const DISCOVERY_API_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  UNKNOWN_OPERATION: "UNKNOWN_OPERATION",
  INVALID_ANSWERS: "INVALID_ANSWERS",
  UNSUPPORTED_PROJECT_TYPE: "UNSUPPORTED_PROJECT_TYPE",
  INVALID_SELECTION: "INVALID_SELECTION",
  UNKNOWN_TEMPLATE: "UNKNOWN_TEMPLATE",
  UNKNOWN_RECIPE: "UNKNOWN_RECIPE",
  INCOMPATIBLE_TEMPLATE: "INCOMPATIBLE_TEMPLATE",
  INCOMPATIBLE_RECIPE: "INCOMPATIBLE_RECIPE",
  RECIPE_CONFLICT: "RECIPE_CONFLICT",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
  DEPENDENCY_CYCLE: "DEPENDENCY_CYCLE",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  INVALID_PROJECT: "INVALID_PROJECT",
  PROJECT_NAME_INVALID: "PROJECT_NAME_INVALID",
  INVALID_PROJECT_DIRECTORY: "INVALID_PROJECT_DIRECTORY",
  TARGET_EXISTS: "TARGET_EXISTS",
  SELECTION_INVALID: "SELECTION_INVALID",
  SCAFFOLD_FAILED: "SCAFFOLD_FAILED",
  SCAFFOLD_VALIDATION_FAILED: "SCAFFOLD_VALIDATION_FAILED",
  INTERNAL: "INTERNAL",
} as const;

export type DiscoveryApiErrorCode =
  (typeof DISCOVERY_API_ERROR_CODES)[keyof typeof DISCOVERY_API_ERROR_CODES];

export type DiscoveryApiError = {
  code: DiscoveryApiErrorCode;
  message: string;
  /** Field-level or entity-level details (stable, serializable strings). */
  details: string[];
};

export type DiscoveryQuestionOptionPayload = {
  value: string;
  label: string;
  hint: string | null;
};

export type DiscoveryQuestionPayload = {
  id: DiscoveryQuestionId;
  prompt: string;
  description: string | null;
  type: DiscoveryQuestionType;
  required: boolean;
  options: DiscoveryQuestionOptionPayload[];
  allowNoPreference: boolean;
  noPreferenceLabel: string | null;
};

export type DiscoveryQuestionsData = {
  /** Next applicable unanswered question, or `null` when the branch is complete. */
  question: DiscoveryQuestionPayload | null;
  complete: boolean;
  answered: DiscoveryQuestionId[];
  progress: { answered: number; total: number };
};

export type DiscoveryReasonPayload = {
  code: string;
  message: string;
  weight: number | null;
};

export type DiscoveryTemplateRecommendationPayload = {
  templateId: string;
  label: string | null;
  scope: string | null;
  uiFramework: string | null;
  score: number;
  compatible: boolean;
  reasons: DiscoveryReasonPayload[];
  warnings: string[];
};

export type DiscoveryRecipeRecommendationPayload = {
  recipeId: string;
  name: string | null;
  categories: string[];
  score: number;
  compatible: boolean;
  relevant: boolean;
  role: RecipeMatchRole;
  reasons: DiscoveryReasonPayload[];
  warnings: string[];
};

export type DiscoveryRecommendationsData = {
  requirements: ProjectRequirements;
  recommendedTemplateId: string | null;
  recommendedRecipeIds: string[];
  templates: DiscoveryTemplateRecommendationPayload[];
  recipes: DiscoveryRecipeRecommendationPayload[];
};

export type DiscoverySelectionErrorPayload = {
  code: DiscoveryApiErrorCode;
  message: string;
  details: string[];
};

export type DiscoveryValidationData = {
  valid: boolean;
  errors: DiscoverySelectionErrorPayload[];
  warnings: string[];
  templateId: string;
  /** Selection after defaults + `dependsOn` expansion (deterministic order). */
  resolvedRecipeIds: string[];
};

export type DiscoveryProjectRequest = {
  name: string;
  directory?: string;
};

export type DiscoveryScaffoldData = {
  projectName: string;
  templateId: string;
  /** Final recipe ids (defaults + `dependsOn` expansion). */
  recipeIds: string[];
  /** Display path relative to the request cwd when possible, otherwise absolute. */
  outputDirectory: string;
};

export type DiscoveryApiSuccessResponse =
  | {
      schemaVersion: DiscoveryApiSchemaVersion;
      ok: true;
      operation: "questions";
      data: DiscoveryQuestionsData;
    }
  | {
      schemaVersion: DiscoveryApiSchemaVersion;
      ok: true;
      operation: "recommendations";
      data: DiscoveryRecommendationsData;
    }
  | {
      schemaVersion: DiscoveryApiSchemaVersion;
      ok: true;
      operation: "validate";
      data: DiscoveryValidationData;
    }
  | {
      schemaVersion: DiscoveryApiSchemaVersion;
      ok: true;
      operation: "scaffold";
      data: DiscoveryScaffoldData;
    };

export type DiscoveryApiErrorResponse = {
  schemaVersion: DiscoveryApiSchemaVersion;
  ok: false;
  operation: DiscoveryOperation | null;
  error: DiscoveryApiError;
};

export type DiscoveryApiResponse = DiscoveryApiSuccessResponse | DiscoveryApiErrorResponse;

/** Parsed (internal) request shape after structural validation. */
export type DiscoveryApiRequest = {
  operation: DiscoveryOperation;
  answers?: DiscoveryAnswers;
  selection?: { templateId: string; recipeIds: string[] };
  project?: DiscoveryProjectRequest;
  confirmation?: { confirmed: boolean };
};
