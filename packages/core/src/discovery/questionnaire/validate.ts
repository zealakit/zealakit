import {
  API_TRAFFIC_EXPECTATIONS,
  BACKEND_FRAMEWORKS,
  BACKEND_RUNTIMES,
  PROJECT_TYPES,
  SERVICE_GOALS,
  VISITOR_ACTIONS,
  WEBSITE_KINDS,
  WORKER_TASKS,
} from "../../constants.js";
import type { ValidationResult } from "../../types.js";
import { DISCOVERY_QUESTIONS, getQuestionOptions, getVisibleQuestions } from "./questions.js";
import {
  API_AUTH_NEEDS,
  API_BACKGROUND_NEEDS,
  API_STORAGE_NEEDS,
  CONTENT_CHANGE_FREQUENCIES,
  DISCOVERY_UI_STACKS,
  type DiscoveryAnswers,
  type DiscoveryQuestionId,
  NO_PREFERENCE,
  SERVICE_CONSUMERS,
  UI_BACKEND_APPROACHES,
  UI_DATA_NEEDS,
  USER_ACCOUNT_NEEDS,
  WORKER_DATA_NEEDS,
  WORKER_QUEUE_NEEDS,
  WORKER_SCHEDULES,
  WORKER_VOLUMES,
} from "./types.js";

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
  websiteKind: WEBSITE_KINDS,
  visitorActions: VISITOR_ACTIONS,
  userAccounts: USER_ACCOUNT_NEEDS,
  uiDataNeed: UI_DATA_NEEDS,
  uiBackendApproach: UI_BACKEND_APPROACHES,
  contentChangeFrequency: CONTENT_CHANGE_FREQUENCIES,
  uiTechPreference: DISCOVERY_UI_STACKS,
  serviceGoals: SERVICE_GOALS,
  serviceConsumers: SERVICE_CONSUMERS,
  apiStorageNeed: API_STORAGE_NEEDS,
  apiAuthNeed: API_AUTH_NEEDS,
  apiBackgroundNeed: API_BACKGROUND_NEEDS,
  apiTrafficExpectation: API_TRAFFIC_EXPECTATIONS,
  backendRuntime: BACKEND_RUNTIMES,
  backendFramework: BACKEND_FRAMEWORKS,
  workerTasks: WORKER_TASKS,
  workerSchedule: WORKER_SCHEDULES,
  workerVolume: WORKER_VOLUMES,
  workerDataNeed: WORKER_DATA_NEEDS,
  workerQueueNeed: WORKER_QUEUE_NEEDS,
};

export type DiscoveryAnswerValidationOptions = {
  /** Allow required visible questions to be unanswered (stateless question flow). */
  partial?: boolean;
};

/** Validate questionnaire answers (enums, types, unknown keys, required visible questions). */
export function validateDiscoveryAnswers(
  answers: DiscoveryAnswers,
  options: DiscoveryAnswerValidationOptions = {},
): ValidationResult {
  const errors: string[] = [];
  const questionIds = new Set(DISCOVERY_QUESTIONS.map((question) => question.id));
  for (const key of Object.keys(answers)) {
    if (!questionIds.has(key as DiscoveryQuestionId)) {
      errors.push(`Unknown answer '${key}'.`);
    }
  }

  const visible = getVisibleQuestions(answers);

  for (const question of visible) {
    const raw = answers[question.id];
    if (raw !== undefined && question.type === "single-select" && typeof raw !== "string") {
      errors.push(`Question '${question.id}' must be a single value.`);
    }
    if (raw !== undefined && question.type === "multi-select" && !Array.isArray(raw)) {
      errors.push(`Question '${question.id}' must be a list of values.`);
    }
    if (question.required && !options.partial) {
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
      const allowedValues = getQuestionOptions(question, answers).map((option) => option.value);
      assertAllowedList(
        errors,
        `Question '${question.id}'`,
        values,
        allowedValues.length > 0 ? allowedValues : ENUMS[question.id],
      );
    }
  }

  const visibleIds = new Set(visible.map((question) => question.id));
  for (const [id, allowed] of Object.entries(ENUMS) as [DiscoveryQuestionId, readonly string[]][]) {
    if (visibleIds.has(id)) {
      continue;
    }
    const raw = answers[id];
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      assertAllowedList(errors, `Answer '${id}'`, raw, allowed);
    } else {
      assertAllowed(errors, `Answer '${id}'`, raw, allowed, true);
    }
  }

  return result([...new Set(errors)]);
}
