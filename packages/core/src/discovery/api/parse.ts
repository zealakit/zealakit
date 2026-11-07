import type { DiscoveryAnswers } from "../questionnaire/types.js";
import {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  DISCOVERY_OPERATIONS,
  type DiscoveryApiError,
  type DiscoveryApiRequest,
  type DiscoveryOperation,
} from "./types.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

type ParseResult =
  | { ok: true; request: DiscoveryApiRequest }
  | { ok: false; error: DiscoveryApiError };

export function parseRequest(input: unknown): ParseResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: {
        code: DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
        message: "The Discovery request must be a JSON object.",
        details: [],
      },
    };
  }

  if (input.schemaVersion !== DISCOVERY_API_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: DISCOVERY_API_ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION,
        message: `Unsupported Discovery schema version. Expected ${DISCOVERY_API_SCHEMA_VERSION}.`,
        details: [`schemaVersion: ${JSON.stringify(input.schemaVersion)}`],
      },
    };
  }

  if (
    typeof input.operation !== "string" ||
    !(DISCOVERY_OPERATIONS as readonly string[]).includes(input.operation)
  ) {
    return {
      ok: false,
      error: {
        code: DISCOVERY_API_ERROR_CODES.UNKNOWN_OPERATION,
        message: `Unknown Discovery operation. Expected one of: ${DISCOVERY_OPERATIONS.join(", ")}.`,
        details: [JSON.stringify(input.operation)],
      },
    };
  }
  const operation = input.operation as DiscoveryOperation;
  const request: DiscoveryApiRequest = { operation };

  if (input.answers !== undefined) {
    if (!isRecord(input.answers)) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
          message: "'answers' must be a JSON object.",
          details: [],
        },
      };
    }
    request.answers = input.answers as DiscoveryAnswers;
  }

  if (operation === "validate" || operation === "scaffold") {
    if (!isRecord(input.selection)) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_SELECTION,
          message: "'selection' must be a JSON object with a templateId.",
          details: [],
        },
      };
    }
    const { templateId, recipeIds } = input.selection;
    if (typeof templateId !== "string" || templateId.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_SELECTION,
          message: "'selection.templateId' must be a non-empty string.",
          details: [],
        },
      };
    }
    if (recipeIds !== undefined && !isStringArray(recipeIds)) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_SELECTION,
          message: "'selection.recipeIds' must be an array of strings.",
          details: [],
        },
      };
    }
    request.selection = { templateId, recipeIds: recipeIds ?? [] };
  }

  if (operation === "scaffold") {
    if (!isRecord(input.project)) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_PROJECT,
          message: "'project' must be a JSON object with a name.",
          details: [],
        },
      };
    }
    const { name, directory } = input.project;
    if (typeof name !== "string" || name.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_PROJECT,
          message: "'project.name' must be a non-empty string.",
          details: [],
        },
      };
    }
    if (directory !== undefined && (typeof directory !== "string" || directory.trim() === "")) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY,
          message: "'project.directory' must be a non-empty string when provided.",
          details: [],
        },
      };
    }
    request.project = {
      name,
      ...(typeof directory === "string" ? { directory } : {}),
    };

    if (!isRecord(input.confirmation) || input.confirmation.confirmed !== true) {
      return {
        ok: false,
        error: {
          code: DISCOVERY_API_ERROR_CODES.CONFIRMATION_REQUIRED,
          message: "Scaffolding requires 'confirmation.confirmed' to be true.",
          details: [],
        },
      };
    }
    request.confirmation = { confirmed: true };
  }

  return { ok: true, request };
}
