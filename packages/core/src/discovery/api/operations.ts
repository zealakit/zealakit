import path from "node:path";
import { ScaffoldValidationError } from "../../diagnostics.js";
import { HYBRID_ORM_WARNING, hybridOrmSelections } from "../../orm-warnings.js";
import {
  getRecipe,
  getRecipeCategories,
  getTemplate,
  withDefaultRecipes,
} from "../../registry/index.js";
import { resolveRecipeDependencies } from "../../resolve-recipes.js";
import { ScaffoldCommitError } from "../../scaffold/commit.js";
import { scaffoldProject } from "../../scaffold/index.js";
import type { ScaffoldConfig, TemplateConfig } from "../../types.js";
import {
  directoryHasFiles,
  validateProjectName,
  validateRecipeCompatibility,
  validateRecipeConflicts,
  validateScaffoldInput,
} from "../../validation/index.js";
import { matchDiscovery } from "../matching/index.js";
import type { DiscoveryResult, MatchReason } from "../matching/types.js";
import {
  DISCOVERY_QUESTIONS,
  type DiscoveryAnswers,
  type DiscoveryQuestion,
  formatUnsupportedProjectTypeMessage,
  getQuestionOptions,
  getVisibleQuestions,
  pruneDiscoveryAnswers,
  resolveDiscoveryRequirements,
  validateDiscoveryAnswers,
} from "../questionnaire/index.js";
import { isRecord, parseRequest } from "./parse.js";
import {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  DISCOVERY_OPERATIONS,
  type DiscoveryApiError,
  type DiscoveryApiErrorResponse,
  type DiscoveryApiRequest,
  type DiscoveryApiResponse,
  type DiscoveryApiSuccessResponse,
  type DiscoveryOperation,
  type DiscoveryQuestionPayload,
  type DiscoveryQuestionsData,
  type DiscoveryReasonPayload,
  type DiscoveryRecommendationsData,
  type DiscoverySelectionErrorPayload,
  type DiscoveryValidationData,
} from "./types.js";

function failure(
  operation: DiscoveryOperation | null,
  code: DiscoveryApiError["code"],
  message: string,
  details: string[] = [],
): DiscoveryApiErrorResponse {
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: false,
    operation,
    error: { code, message, details },
  };
}

function serializeQuestion(
  question: DiscoveryQuestion,
  answers: DiscoveryAnswers,
): DiscoveryQuestionPayload {
  return {
    id: question.id,
    prompt: question.prompt,
    description: question.description ?? null,
    type: question.type,
    required: question.required,
    options: getQuestionOptions(question, answers).map((option) => ({
      value: option.value,
      label: option.label,
      hint: option.hint ?? null,
    })),
    allowNoPreference: question.allowNoPreference === true,
    noPreferenceLabel: question.noPreferenceLabel ?? null,
  };
}

function questionsResponse(
  request: DiscoveryApiRequest,
): DiscoveryApiSuccessResponse | DiscoveryApiErrorResponse {
  const rawAnswers = request.answers ?? {};
  const validation = validateDiscoveryAnswers(rawAnswers, { partial: true });
  if (!validation.valid) {
    return failure(
      "questions",
      DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
      "The submitted answers are invalid.",
      validation.errors,
    );
  }

  const answers = pruneDiscoveryAnswers(rawAnswers);
  if (answers.projectType === "complete-product") {
    const message = formatUnsupportedProjectTypeMessage();
    return failure("questions", DISCOVERY_API_ERROR_CODES.UNSUPPORTED_PROJECT_TYPE, message, [
      message,
    ]);
  }

  const visible = getVisibleQuestions(answers);
  const next = visible.find((question) => !(question.id in answers)) ?? null;
  const answered = DISCOVERY_QUESTIONS.filter((question) => question.id in answers).map(
    (question) => question.id,
  );
  const data: DiscoveryQuestionsData = {
    question: next ? serializeQuestion(next, answers) : null,
    complete: next === null,
    answered,
    progress: { answered: answered.length, total: visible.length },
  };
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: true,
    operation: "questions",
    data,
  };
}

function serializeReason(reason: MatchReason): DiscoveryReasonPayload {
  return {
    code: reason.code,
    message: reason.message,
    weight: reason.weight ?? null,
  };
}

function recommendationsData(
  result: DiscoveryResult,
  requirements: DiscoveryRecommendationsData["requirements"],
): DiscoveryRecommendationsData {
  return {
    // Round-trip through JSON: strips undefined optional fields and keeps plain objects.
    requirements: JSON.parse(
      JSON.stringify(requirements),
    ) as DiscoveryRecommendationsData["requirements"],
    recommendedTemplateId: result.recommendedTemplateId ?? null,
    recommendedRecipeIds: [...result.recommendedRecipeIds],
    templates: result.templates.map((entry) => {
      const template = getTemplate(entry.templateId);
      return {
        templateId: entry.templateId,
        label: template?.label ?? null,
        scope: template?.scope ?? null,
        uiFramework: template?.uiFramework ?? null,
        score: entry.score,
        compatible: entry.compatible,
        reasons: entry.reasons.map(serializeReason),
        warnings: [...entry.warnings],
      };
    }),
    recipes: result.recipes.map((entry) => {
      const recipe = getRecipe(entry.recipeId);
      return {
        recipeId: entry.recipeId,
        name: recipe?.name ?? null,
        categories: recipe ? getRecipeCategories(recipe) : [],
        score: entry.score,
        compatible: entry.compatible,
        relevant: entry.relevant,
        role: entry.role,
        reasons: entry.reasons.map(serializeReason),
        warnings: [...entry.warnings],
      };
    }),
  };
}

function recommendationsResponse(
  request: DiscoveryApiRequest,
): DiscoveryApiSuccessResponse | DiscoveryApiErrorResponse {
  if (request.answers === undefined) {
    return failure(
      "recommendations",
      DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
      "'answers' is required for recommendations.",
    );
  }

  const validation = validateDiscoveryAnswers(request.answers);
  if (!validation.valid) {
    return failure(
      "recommendations",
      DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
      "The submitted answers are invalid.",
      validation.errors,
    );
  }

  const answers = pruneDiscoveryAnswers(request.answers);
  const resolved = resolveDiscoveryRequirements(answers);
  if (!resolved.ok) {
    const code =
      answers.projectType === "complete-product"
        ? DISCOVERY_API_ERROR_CODES.UNSUPPORTED_PROJECT_TYPE
        : DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS;
    return failure("recommendations", code, resolved.errors.join(" "), resolved.errors);
  }

  const result = matchDiscovery(resolved.requirements);
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: true,
    operation: "recommendations",
    data: recommendationsData(result, resolved.requirements),
  };
}

type SelectionEvaluation =
  | { ok: true; template: TemplateConfig; data: DiscoveryValidationData }
  | { ok: false; error: DiscoveryApiError };

function selectionFailure(
  code: DiscoveryApiError["code"],
  message: string,
  details: string[] = [],
): { ok: false; error: DiscoveryApiError } {
  return { ok: false, error: { code, message, details } };
}

/** Read-only selection evaluation shared by `validate` and `scaffold`. */
function evaluateSelection(request: DiscoveryApiRequest): SelectionEvaluation {
  const selection = request.selection;
  if (!selection) {
    return selectionFailure(
      DISCOVERY_API_ERROR_CODES.INVALID_SELECTION,
      "'selection' is required for validation.",
    );
  }

  const template = getTemplate(selection.templateId);
  if (!template) {
    return selectionFailure(
      DISCOVERY_API_ERROR_CODES.UNKNOWN_TEMPLATE,
      `Unknown template '${selection.templateId}'.`,
      [selection.templateId],
    );
  }

  const unknownRecipes = selection.recipeIds.filter((recipeId) => !getRecipe(recipeId));
  if (unknownRecipes.length > 0) {
    return selectionFailure(
      DISCOVERY_API_ERROR_CODES.UNKNOWN_RECIPE,
      "Unknown recipe(s) in the selection.",
      unknownRecipes,
    );
  }

  // Validate answers first when provided: selection compatibility depends on them.
  if (request.answers !== undefined) {
    const answersValidation = validateDiscoveryAnswers(request.answers);
    if (!answersValidation.valid) {
      return selectionFailure(
        DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
        "The submitted answers are invalid.",
        answersValidation.errors,
      );
    }
  }

  const errors: DiscoverySelectionErrorPayload[] = [];
  const warnings: string[] = [];

  const withDefaults = withDefaultRecipes(template.scope, selection.recipeIds);
  const resolved = resolveRecipeDependencies(withDefaults);
  if (!resolved.ok) {
    if (resolved.error.code === "missing") {
      errors.push({
        code: DISCOVERY_API_ERROR_CODES.MISSING_DEPENDENCY,
        message: `Recipe '${resolved.error.requiredBy}' depends on '${resolved.error.recipeId}', which is not registered.`,
        details: [resolved.error.recipeId],
      });
    } else {
      errors.push({
        code: DISCOVERY_API_ERROR_CODES.DEPENDENCY_CYCLE,
        message: "Circular recipe dependency.",
        details: [resolved.error.cycle.join(" -> ")],
      });
    }
  } else if (resolved.autoInjected.length > 0) {
    warnings.push(`Auto-injected recipe dependencies: ${resolved.autoInjected.join(", ")}.`);
  }

  for (const message of validateRecipeConflicts(selection.recipeIds).errors) {
    errors.push({ code: DISCOVERY_API_ERROR_CODES.RECIPE_CONFLICT, message, details: [] });
  }

  for (const message of validateRecipeCompatibility(selection.templateId, selection.recipeIds)
    .errors) {
    errors.push({ code: DISCOVERY_API_ERROR_CODES.INCOMPATIBLE_RECIPE, message, details: [] });
  }

  if (request.answers !== undefined) {
    const answers = pruneDiscoveryAnswers(request.answers);
    const requirements = resolveDiscoveryRequirements(answers);
    if (!requirements.ok) {
      const code =
        answers.projectType === "complete-product"
          ? DISCOVERY_API_ERROR_CODES.UNSUPPORTED_PROJECT_TYPE
          : DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS;
      return selectionFailure(code, requirements.errors.join(" "), requirements.errors);
    }

    const discovery = matchDiscovery(requirements.requirements, {
      templateId: selection.templateId,
    });
    const templateMatch = discovery.templates.find(
      (entry) => entry.templateId === selection.templateId,
    );
    if (templateMatch && !templateMatch.compatible) {
      errors.push({
        code: DISCOVERY_API_ERROR_CODES.INCOMPATIBLE_TEMPLATE,
        message: `Template '${selection.templateId}' is not compatible with the submitted answers.`,
        details: templateMatch.reasons.map((reason) => reason.message),
      });
    }
    for (const recipeId of selection.recipeIds) {
      const recipeMatch = discovery.recipes.find((entry) => entry.recipeId === recipeId);
      if (recipeMatch && !recipeMatch.compatible) {
        errors.push({
          code: DISCOVERY_API_ERROR_CODES.INCOMPATIBLE_RECIPE,
          message: `Recipe '${recipeId}' is not compatible with the submitted answers.`,
          details: recipeMatch.reasons.map((reason) => reason.message),
        });
      }
    }
  }

  const resolvedRecipeIds = resolved.ok ? resolved.recipeIds : withDefaults;
  const hybridOrm = hybridOrmSelections(template, resolvedRecipeIds);
  if (hybridOrm.length > 0) {
    warnings.push(`${HYBRID_ORM_WARNING} (selected: ${hybridOrm.join(", ")})`);
  }

  return {
    ok: true,
    template,
    data: {
      valid: errors.length === 0,
      errors,
      warnings,
      templateId: selection.templateId,
      resolvedRecipeIds,
    },
  };
}

function validateResponse(
  request: DiscoveryApiRequest,
): DiscoveryApiSuccessResponse | DiscoveryApiErrorResponse {
  const evaluation = evaluateSelection(request);
  if (!evaluation.ok) {
    return failure(
      "validate",
      evaluation.error.code,
      evaluation.error.message,
      evaluation.error.details,
    );
  }
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: true,
    operation: "validate",
    data: evaluation.data,
  };
}

/** Keep public errors free of absolute staging/backup paths. */
function redactAbsolutePaths(message: string): string {
  return message.replace(/(?:[A-Za-z]:)?(?:[\\/][^\s'"]+)+/g, "<path>");
}

function displayDirectory(cwd: string, targetDir: string): string {
  const relative = path.relative(cwd, targetDir);
  if (relative === "") {
    return ".";
  }
  if (path.isAbsolute(relative) || relative.startsWith("..")) {
    return targetDir;
  }
  return relative;
}

export type DiscoveryApiOptions = {
  /** Base directory for scaffold destinations (defaults to `process.cwd()`). */
  cwd?: string;
};

async function scaffoldResponse(
  request: DiscoveryApiRequest,
  options: DiscoveryApiOptions,
): Promise<DiscoveryApiResponse> {
  // Re-run the full selection validation; a prior `validate` response is never authorization.
  const evaluation = evaluateSelection(request);
  if (!evaluation.ok) {
    return failure(
      "scaffold",
      evaluation.error.code,
      evaluation.error.message,
      evaluation.error.details,
    );
  }
  if (!evaluation.data.valid) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.SELECTION_INVALID,
      "The submitted selection is invalid.",
      evaluation.data.errors.map((error) => error.message),
    );
  }

  const project = request.project;
  const selection = request.selection;
  if (!project || !selection) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.INVALID_PROJECT,
      "'project' and 'selection' are required for scaffolding.",
    );
  }
  if (request.confirmation?.confirmed !== true) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.CONFIRMATION_REQUIRED,
      "Scaffolding requires 'confirmation.confirmed' to be true.",
    );
  }

  const nameValidation = validateProjectName(project.name, selection.templateId);
  if (!nameValidation.valid) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.PROJECT_NAME_INVALID,
      "Invalid project name.",
      nameValidation.errors,
    );
  }

  const cwd = options.cwd ?? process.cwd();
  let parentDir = cwd;
  let targetDir = path.resolve(cwd, project.name);
  if (project.directory !== undefined) {
    targetDir = path.resolve(cwd, project.directory);
    parentDir = path.dirname(targetDir);
    if (path.basename(targetDir) !== project.name) {
      return failure(
        "scaffold",
        DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY,
        "'project.directory' basename must match 'project.name'.",
        [project.directory],
      );
    }
  }

  const displayTarget = displayDirectory(cwd, targetDir);
  const relativeToCwd = path.relative(targetDir, cwd);
  if (
    relativeToCwd === "" ||
    (!relativeToCwd.startsWith("..") && !path.isAbsolute(relativeToCwd))
  ) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY,
      "Project directory must be a new directory, not the working directory or one of its parents.",
      [displayTarget],
    );
  }

  if (directoryHasFiles(targetDir)) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.TARGET_EXISTS,
      `Target directory '${displayTarget}' already exists and is not empty.`,
      [displayTarget],
    );
  }

  const config: ScaffoldConfig = {
    projectName: project.name,
    templateId: selection.templateId,
    recipeIds: evaluation.data.resolvedRecipeIds,
  };
  const inputValidation = await validateScaffoldInput(config, parentDir, { yes: true });
  if (!inputValidation.valid) {
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.SELECTION_INVALID,
      "The submitted selection is invalid.",
      inputValidation.errors,
    );
  }

  try {
    const outputDir = await scaffoldProject(config, parentDir);
    return {
      schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
      ok: true,
      operation: "scaffold",
      data: {
        projectName: project.name,
        templateId: selection.templateId,
        recipeIds: [...evaluation.data.resolvedRecipeIds],
        outputDirectory: displayDirectory(cwd, outputDir),
      },
    };
  } catch (error) {
    if (error instanceof ScaffoldValidationError) {
      return failure(
        "scaffold",
        DISCOVERY_API_ERROR_CODES.SCAFFOLD_VALIDATION_FAILED,
        "Project validation failed.",
        (error.errors.length > 0 ? error.errors : [error.message]).map(redactAbsolutePaths),
      );
    }
    if (error instanceof ScaffoldCommitError) {
      return failure(
        "scaffold",
        DISCOVERY_API_ERROR_CODES.SCAFFOLD_FAILED,
        "Project creation failed while writing the destination.",
      );
    }
    return failure(
      "scaffold",
      DISCOVERY_API_ERROR_CODES.SCAFFOLD_FAILED,
      "Project creation failed.",
    );
  }
}

/**
 * Execute one stateless Discovery operation.
 *
 * The caller owns the answers; the function derives the next question, the
 * recommendations, the selection validation, or (only with explicit
 * confirmation) executes the existing scaffold pipeline. It never persists
 * state and never touches terminal I/O.
 */
export async function handleDiscoveryRequest(
  input: unknown,
  options: DiscoveryApiOptions = {},
): Promise<DiscoveryApiResponse> {
  const parsed = parseRequest(input);
  if (!parsed.ok) {
    const operation =
      isRecord(input) &&
      typeof input.operation === "string" &&
      (DISCOVERY_OPERATIONS as readonly string[]).includes(input.operation)
        ? (input.operation as DiscoveryOperation)
        : null;
    return failure(operation, parsed.error.code, parsed.error.message, parsed.error.details);
  }

  try {
    switch (parsed.request.operation) {
      case "questions":
        return questionsResponse(parsed.request);
      case "recommendations":
        return recommendationsResponse(parsed.request);
      case "validate":
        return validateResponse(parsed.request);
      case "scaffold":
        return await scaffoldResponse(parsed.request, options);
    }
  } catch {
    // Never leak stack traces or filesystem paths through the API.
    return failure(
      parsed.request.operation,
      DISCOVERY_API_ERROR_CODES.INTERNAL,
      "Unexpected failure while processing the Discovery request.",
    );
  }
}
