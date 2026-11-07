import { ECOSYSTEMS } from "./constants.js";
import { ScaffoldValidationError } from "./diagnostics.js";
import {
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiErrorCode,
  type DiscoveryApiResponse,
  type DiscoveryQuestionsData,
  type DiscoveryRecommendationsData,
  type DiscoveryValidationData,
  handleDiscoveryRequest,
} from "./discovery/api/index.js";
import type { DiscoveryAnswers } from "./discovery/questionnaire/types.js";
import {
  type EcosystemMetadata,
  getEcosystemMetadata,
  getRecipeMetadata,
  getTemplateMetadata,
  type InfoFilter,
  type RecipeMetadata,
  type TemplateMetadata,
} from "./info/index.js";
import { scaffoldProject } from "./scaffold/index.js";
import { buildScaffoldPlan, type ScaffoldPlan } from "./scaffold/plan.js";
import type { EcosystemId, ScaffoldConfig } from "./types.js";
import { validateScaffoldInput } from "./validation/index.js";

/**
 * Explicit ecosystem registration for programmatic consumers.
 * The CLI exposes the same `registerNodeEcosystem` / `registerGoEcosystem`
 * functions; the API never imports ecosystem packages itself.
 */
export type EcosystemRegistration = {
  id: EcosystemId;
  register: () => void;
};

export type ZealakitOptions = {
  /**
   * Ecosystems to register for this process. Registration is process-global
   * (the existing registry is the single source of truth); creating multiple
   * instances does not duplicate entries.
   */
  ecosystems?: readonly EcosystemRegistration[];
};

/** Structured error raised by Discovery API operations. */
export class ZealakitApiError extends Error {
  readonly code: DiscoveryApiErrorCode;
  readonly details: string[];

  constructor(error: { code: DiscoveryApiErrorCode; message: string; details: string[] }) {
    super(error.message);
    this.name = "ZealakitApiError";
    this.code = error.code;
    this.details = [...error.details];
  }
}

export type MetadataQuery = {
  getEcosystems: (filter?: InfoFilter) => EcosystemMetadata[];
  getTemplates: (filter?: InfoFilter) => TemplateMetadata[];
  getRecipes: (filter?: InfoFilter) => RecipeMetadata[];
};

export type DiscoveryQuery = {
  /** Next applicable question (or `null` when complete). */
  getQuestions: (options?: { answers?: DiscoveryAnswers }) => Promise<DiscoveryQuestionsData>;
  getRecommendations: (options: {
    answers: DiscoveryAnswers;
  }) => Promise<DiscoveryRecommendationsData>;
  /** Returns validation data; an invalid selection is `data.valid === false`, not an exception. */
  validateSelection: (options: {
    answers?: DiscoveryAnswers;
    selection: { templateId: string; recipeIds: string[] };
  }) => Promise<DiscoveryValidationData>;
};

export type ScaffoldClient = {
  /** Read-only preflight; never writes files. */
  plan: (config: ScaffoldConfig, options?: { cwd?: string }) => ScaffoldPlan;
  /** Explicit execution through the existing scaffold pipeline. */
  create: (config: ScaffoldConfig, options?: { cwd?: string }) => Promise<ScaffoldExecutionResult>;
};

export type ScaffoldExecutionResult = {
  outputDirectory: string;
  projectName: string;
  templateId: string;
  recipeIds: string[];
};

export type Zealakit = {
  /** Ecosystems registered through this instance. */
  ecosystems: readonly EcosystemId[];
  metadata: MetadataQuery;
  discovery: DiscoveryQuery;
  scaffold: ScaffoldClient;
};

function validateEcosystems(ecosystems: readonly EcosystemRegistration[]): EcosystemId[] {
  const ids = new Set<EcosystemId>();
  for (const ecosystem of ecosystems) {
    if (!(ECOSYSTEMS as readonly string[]).includes(ecosystem.id)) {
      throw new Error(`Unknown ecosystem '${String(ecosystem.id)}'.`);
    }
    if (ids.has(ecosystem.id)) {
      throw new Error(`Duplicate ecosystem '${ecosystem.id}'.`);
    }
    if (typeof ecosystem.register !== "function") {
      throw new Error(`Ecosystem '${ecosystem.id}' must provide a register() function.`);
    }
    ids.add(ecosystem.id);
  }
  return [...ids];
}

function unwrap<T>(response: DiscoveryApiResponse, operation: string): T {
  if (!response.ok) {
    throw new ZealakitApiError(response.error);
  }
  if (response.operation !== operation) {
    throw new Error(`Unexpected Discovery operation '${response.operation}'.`);
  }
  return response.data as T;
}

/**
 * Create a programmatic Zealakit client over the existing registry, Discovery
 * engine, metadata query layer, and scaffold pipeline.
 */
export function createZealakit(options: ZealakitOptions = {}): Zealakit {
  const ecosystems = validateEcosystems(options.ecosystems ?? []);
  // Register only after the whole option set validated, so failures are side-effect free.
  for (const ecosystem of options.ecosystems ?? []) {
    ecosystem.register();
  }

  return {
    ecosystems,
    metadata: {
      getEcosystems: (filter = {}) => getEcosystemMetadata(filter),
      getTemplates: (filter = {}) => getTemplateMetadata(filter),
      getRecipes: (filter = {}) => getRecipeMetadata(filter),
    },
    discovery: {
      async getQuestions(options = {}) {
        const response = await handleDiscoveryRequest({
          schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
          operation: "questions",
          answers: options.answers ?? {},
        });
        return unwrap<DiscoveryQuestionsData>(response, "questions");
      },
      async getRecommendations({ answers }) {
        const response = await handleDiscoveryRequest({
          schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
          operation: "recommendations",
          answers,
        });
        return unwrap<DiscoveryRecommendationsData>(response, "recommendations");
      },
      async validateSelection({ answers, selection }) {
        const response = await handleDiscoveryRequest({
          schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
          operation: "validate",
          ...(answers === undefined ? {} : { answers }),
          selection,
        });
        return unwrap<DiscoveryValidationData>(response, "validate");
      },
    },
    scaffold: {
      plan(config, planOptions = {}) {
        return buildScaffoldPlan(config, planOptions.cwd ?? process.cwd());
      },
      async create(config, createOptions = {}) {
        const cwd = createOptions.cwd ?? process.cwd();
        // Same non-interactive safety check the CLI uses (`yes` refuses non-empty
        // targets without prompting) before the staging/commit pipeline writes.
        const validation = await validateScaffoldInput(config, cwd, { yes: true });
        if (!validation.valid) {
          throw new ScaffoldValidationError(validation.errors.join("\n"), validation.errors);
        }
        const outputDirectory = await scaffoldProject(config, cwd);
        return {
          outputDirectory,
          projectName: config.projectName,
          templateId: config.templateId,
          recipeIds: [...config.recipeIds],
        };
      },
    },
  };
}
