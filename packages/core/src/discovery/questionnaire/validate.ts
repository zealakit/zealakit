import {
  ARCHITECTURE_LEVELS,
  BACKEND_FRAMEWORKS,
  BACKEND_RUNTIMES,
  CAPABILITIES,
  DATABASE_TYPES,
  DEPLOYMENT_TARGETS,
  FRONTEND_MODES,
  PROJECT_PURPOSES,
  PROJECT_TYPES,
  SCOPES,
  UI_FRAMEWORKS,
} from "../../constants.js";
import type { ValidationResult } from "../../types.js";
import { getQuestionOptions, getVisibleQuestions } from "./questions.js";
import type { DiscoveryAnswers, DiscoveryQuestionId } from "./types.js";
import { NO_PREFERENCE } from "./types.js";

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

function assertAllowed(
  errors: string[],
  label: string,
  value: string | undefined,
  allowed: readonly string[],
  allowNoPreference: boolean,
): void {
  if (value === undefined) {
    return;
  }
  if (allowNoPreference && value === NO_PREFERENCE) {
    return;
  }
  if (!allowed.includes(value)) {
    errors.push(`${label} has invalid value '${value}'.`);
  }
}

function assertAllowedList(
  errors: string[],
  label: string,
  values: readonly string[] | undefined,
  allowed: readonly string[],
): void {
  if (!values) {
    return;
  }
  for (const value of values) {
    if (!allowed.includes(value)) {
      errors.push(`${label} has invalid value '${value}'.`);
    }
  }
}

const ENUMS: Record<DiscoveryQuestionId, readonly string[]> = {
  projectType: PROJECT_TYPES,
  purpose: PROJECT_PURPOSES,
  scopes: SCOPES,
  frontendFramework: UI_FRAMEWORKS,
  frontendMode: FRONTEND_MODES,
  backendRuntime: BACKEND_RUNTIMES,
  backendFramework: BACKEND_FRAMEWORKS,
  capabilities: CAPABILITIES,
  databases: DATABASE_TYPES,
  deploymentTarget: DEPLOYMENT_TARGETS,
  architectureLevel: ARCHITECTURE_LEVELS,
};

/** Validate questionnaire answers (enums, required visible questions). */
export function validateDiscoveryAnswers(answers: DiscoveryAnswers): ValidationResult {
  const errors: string[] = [];
  const visible = getVisibleQuestions(answers);

  for (const question of visible) {
    const raw = answers[question.id];
    if (question.required) {
      if (raw === undefined || (Array.isArray(raw) && raw.length === 0)) {
        errors.push(`Question '${question.id}' is required.`);
      }
    }

    if (question.type === "single-select") {
      const value = typeof raw === "string" ? raw : undefined;
      const allowedValues = getQuestionOptions(question, answers).map((option) => option.value);
      assertAllowed(
        errors,
        `Question '${question.id}'`,
        value,
        allowedValues,
        Boolean(question.allowNoPreference),
      );
    } else {
      const values = Array.isArray(raw) ? raw : undefined;
      assertAllowedList(errors, `Question '${question.id}'`, values, ENUMS[question.id]);
    }
  }

  // Also reject values on hidden questions that somehow remain (stale state)
  for (const [id, allowed] of Object.entries(ENUMS) as [DiscoveryQuestionId, readonly string[]][]) {
    const raw = answers[id];
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      assertAllowedList(errors, `Answer '${id}'`, raw, allowed);
    } else {
      assertAllowed(errors, `Answer '${id}'`, raw, allowed, true);
    }
  }

  return result(errors);
}
