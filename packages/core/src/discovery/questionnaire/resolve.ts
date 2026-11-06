import type {
  FrontendDelivery,
  FrontendMode,
  ProcessingModel,
  ProjectPurpose,
  RecipeInterest,
  ServiceGoal,
  UiFramework,
  WebsiteKind,
} from "../../constants.js";
import { isSupportedProjectType, UI_FRAMEWORKS } from "../../constants.js";
import type { ProjectRequirements } from "../requirements.js";
import { formatUnsupportedProjectTypeMessage } from "./questions.js";
import type { DiscoveryAnswers, DiscoveryUiStack } from "./types.js";
import { NO_PREFERENCE } from "./types.js";

export type RequirementProvenance = "explicit" | "inferred" | "default";

export type ResolvedRequirementNote = {
  field: string;
  value: string;
  source: RequirementProvenance;
  reason: string;
};

export type ResolveDiscoveryResult =
  | {
      ok: true;
      requirements: ProjectRequirements;
      notes: ResolvedRequirementNote[];
    }
  | { ok: false; errors: string[] };

function omitPreference<T extends string>(
  value: T | typeof NO_PREFERENCE | undefined,
): T | undefined {
  if (value === undefined || value === NO_PREFERENCE) {
    return undefined;
  }
  return value;
}

function isUiFramework(value: DiscoveryUiStack): value is UiFramework {
  return (UI_FRAMEWORKS as readonly string[]).includes(value);
}

function note(
  field: string,
  value: string,
  source: RequirementProvenance,
  reason: string,
): ResolvedRequirementNote {
  return { field, value, source, reason };
}

/**
 * Soft rendering preference from product intent.
 * Must never become a hard eligibility filter — only ranking.
 */
function inferPreferredUiMode(answers: DiscoveryAnswers): FrontendMode | undefined {
  const frequency = omitPreference(answers.contentChangeFrequency);
  const kind = omitPreference(answers.websiteKind);

  // Website kind is a stronger intent signal than update frequency.
  if (kind === "management-dashboard" || kind === "interactive-tool" || kind === "online-store") {
    return "spa";
  }
  if (
    kind === "blog-content" ||
    kind === "portfolio" ||
    kind === "landing-page" ||
    kind === "business-marketing"
  ) {
    return "ssg";
  }

  // Frequency only when kind is unknown / other.
  if (frequency === "realtime") {
    return "ssr";
  }
  if (frequency === "rarely" || frequency === "occasionally") {
    return "ssg";
  }
  if (frequency === "frequently") {
    // Soft preference for server-capable stacks — does not exclude Vite/Astro client.
    return "ssr";
  }
  return undefined;
}

function inferUiPurpose(kind: WebsiteKind | undefined): ProjectPurpose | undefined {
  switch (kind) {
    case "business-marketing":
    case "landing-page":
      return "business";
    case "blog-content":
    case "portfolio":
      return "content-platform";
    case "management-dashboard":
    case "interactive-tool":
      return "internal-tool";
    case "online-store":
      return "ecommerce";
    default:
      return undefined;
  }
}

function inferUiRecipeInterests(answers: DiscoveryAnswers): RecipeInterest[] {
  const interests = new Set<RecipeInterest>();
  const actions = answers.visitorActions ?? [];
  if (actions.includes("submit-forms")) interests.add("form");
  if (actions.includes("call-existing-api")) interests.add("fetcher");
  if (
    actions.includes("manage-information") ||
    answers.websiteKind === "management-dashboard" ||
    answers.websiteKind === "interactive-tool"
  ) {
    interests.add("state");
  }
  if (actions.includes("browse-catalog") || answers.websiteKind === "online-store") {
    interests.add("ui");
  }
  return [...interests];
}

function resolveUi(answers: DiscoveryAnswers): ResolveDiscoveryResult {
  const notes: ResolvedRequirementNote[] = [];
  const requirements: ProjectRequirements = {
    projectType: "ui",
    scopes: [],
    capabilities: [],
  };

  const stack = omitPreference(answers.uiTechPreference);
  const frontend: NonNullable<Extract<ProjectRequirements, { projectType: "ui" }>["frontend"]> = {};

  if (stack && isUiFramework(stack)) {
    frontend.framework = stack;
    notes.push(note("frontend.framework", stack, "explicit", "User chose a UI technology."));
  } else if (stack === "astro") {
    frontend.delivery = "astro" satisfies FrontendDelivery;
    notes.push(note("frontend.delivery", "astro", "explicit", "User chose Astro."));
  }

  const preferredMode = inferPreferredUiMode(answers);
  if (preferredMode) {
    frontend.preferredMode = preferredMode;
    notes.push(
      note(
        "frontend.preferredMode",
        preferredMode,
        "inferred",
        "Soft ranking signal from website type / content updates — not a hard filter.",
      ),
    );
  }

  if (Object.keys(frontend).length > 0) {
    requirements.frontend = frontend;
  }

  const purpose = inferUiPurpose(omitPreference(answers.websiteKind));
  if (purpose) {
    requirements.purpose = purpose;
    notes.push(
      note("purpose", purpose, "inferred", "Mapped from the kind of website you described."),
    );
  }

  const actions = answers.visitorActions ?? [];
  const needsPersistentData =
    answers.uiDataNeed === "store-retrieve" ||
    answers.uiDataNeed === "user-managed" ||
    actions.includes("manage-information") ||
    actions.includes("make-purchases");
  const needsAuth = answers.userAccounts === "sign-in" || answers.userAccounts === "roles";
  const backendApproach = omitPreference(answers.uiBackendApproach);
  const wantsExistingApi =
    actions.includes("call-existing-api") || backendApproach === "existing-api";
  const includeServerInProject = backendApproach === "include-server";

  // Auth / saved-data alone never force a full-stack UI template.
  // Only "include-server" hard-requires a data-capable (hybrid) starter.
  if (includeServerInProject) {
    requirements.capabilities = ["database"];
    notes.push(
      note(
        "capabilities.database",
        "required",
        "explicit",
        "User asked to include server / data features in this UI project.",
      ),
    );
  } else if (needsPersistentData || wantsExistingApi || needsAuth) {
    requirements.externalApi = true;
    notes.push(
      note(
        "externalApi",
        "true",
        wantsExistingApi || actions.includes("call-existing-api") ? "explicit" : "inferred",
        "Accounts or saved data are treated as UI integrations — client starters stay eligible.",
      ),
    );
  }

  const interests = [...inferUiRecipeInterests(answers)];
  if (requirements.externalApi && !interests.includes("fetcher")) {
    interests.push("fetcher");
  }
  if (interests.length > 0) {
    requirements.recipeInterests = interests;
    notes.push(
      note(
        "recipeInterests",
        interests.join(","),
        "inferred",
        "Mapped from visitor actions / website kind to optional recipe categories.",
      ),
    );
  }

  if (needsAuth) {
    notes.push(
      note(
        "authentication",
        answers.userAccounts ?? "sign-in",
        "explicit",
        "Sign-in needed in the UI — does not require Next.js/Nuxt by itself; no auth recipe ships yet.",
      ),
    );
  }

  return { ok: true, requirements, notes };
}

function inferServerPurpose(goals: readonly ServiceGoal[]): ProjectPurpose | undefined {
  if (
    goals.includes("business-operations") ||
    goals.includes("payments") ||
    goals.includes("manage-accounts")
  ) {
    return "business";
  }
  if (goals.length > 0) {
    return "api-service";
  }
  return undefined;
}

function resolveServer(answers: DiscoveryAnswers): ResolveDiscoveryResult {
  const notes: ResolvedRequirementNote[] = [];
  const requirements: Extract<ProjectRequirements, { projectType: "server-api" }> = {
    projectType: "server-api",
    scopes: [],
    capabilities: [],
  };

  const runtime = omitPreference(answers.backendRuntime);
  const framework = omitPreference(answers.backendFramework);
  if (runtime || framework) {
    requirements.backend = {
      ...(runtime ? { runtime } : {}),
      ...(framework ? { framework } : {}),
    };
    if (runtime) {
      notes.push(note("backend.runtime", runtime, "explicit", "User technology preference."));
    }
    if (framework) {
      notes.push(note("backend.framework", framework, "explicit", "User framework preference."));
    }
  }

  // Default service shape: REST is what templates support today.
  requirements.serviceType = "rest";
  notes.push(
    note(
      "serviceType",
      "rest",
      "default",
      "Current API starters are HTTP/REST-style; GraphQL/RPC are not offered in the default flow.",
    ),
  );

  const goals = answers.serviceGoals ?? [];
  const purpose = inferServerPurpose(goals);
  if (purpose) {
    requirements.purpose = purpose;
    notes.push(
      note("purpose", purpose, "inferred", "Mapped from the kinds of work your service will do."),
    );
  }

  const traffic = omitPreference(answers.apiTrafficExpectation);
  if (traffic) {
    requirements.trafficExpectation = traffic;
    notes.push(
      note(
        "trafficExpectation",
        traffic,
        "explicit",
        "Soft ranking signal for expected request volume and concurrency.",
      ),
    );
  }

  const storage = omitPreference(answers.apiStorageNeed);
  const wantsDb =
    storage === "relational" ||
    storage === "flexible" ||
    storage === "both" ||
    goals.includes("store-retrieve") ||
    goals.includes("manage-accounts") ||
    goals.includes("payments");

  if (storage === "flexible") {
    requirements.databaseKind = "nosql";
    requirements.capabilities = ["database"];
    notes.push(
      note(
        "databaseKind",
        "nosql",
        "explicit",
        "Flexible/document storage is not supported by current recipes.",
      ),
    );
  } else if (storage === "both") {
    requirements.databaseKind = "sql";
    requirements.capabilities = ["database"];
    notes.push(
      note(
        "databaseKind",
        "sql",
        "inferred",
        "Starting with structured/SQL data; flexible document storage is limited today.",
      ),
    );
  } else if (storage === "relational" || (wantsDb && storage !== "none")) {
    requirements.databaseKind = "sql";
    requirements.capabilities = ["database"];
    notes.push(
      note(
        "databaseKind",
        "sql",
        storage === "relational" ? "explicit" : "inferred",
        "Service needs lasting structured data.",
      ),
    );
  }

  if (requirements.capabilities.includes("database")) {
    const interests = new Set<RecipeInterest>(requirements.recipeInterests ?? []);
    interests.add("orm");
    requirements.recipeInterests = [...interests];
    notes.push(
      note(
        "recipeInterests",
        "orm",
        "inferred",
        "Database need suggests an ORM recipe when available.",
      ),
    );
  }

  if (
    answers.apiAuthNeed &&
    answers.apiAuthNeed !== "no" &&
    answers.apiAuthNeed !== NO_PREFERENCE
  ) {
    notes.push(
      note(
        "authentication",
        answers.apiAuthNeed,
        "explicit",
        "Auth requested — no auth recipe ships yet; preference recorded only.",
      ),
    );
  }

  if (answers.apiBackgroundNeed === "background" || answers.apiBackgroundNeed === "queue") {
    notes.push(
      note(
        "background",
        answers.apiBackgroundNeed,
        "explicit",
        "Background work noted — this release still recommends a single API template (not a separate worker).",
      ),
    );
  }

  return { ok: true, requirements, notes };
}

function resolveWorker(answers: DiscoveryAnswers): ResolveDiscoveryResult {
  const notes: ResolvedRequirementNote[] = [];
  const requirements: ProjectRequirements = {
    projectType: "background-worker",
    scopes: [],
    capabilities: [],
  };

  const runtime = omitPreference(answers.backendRuntime);
  const framework = omitPreference(answers.backendFramework);
  if (runtime || framework) {
    requirements.backend = {
      ...(runtime ? { runtime } : {}),
      ...(framework ? { framework } : {}),
    };
  }

  const schedule = omitPreference(answers.workerSchedule);
  if (schedule) {
    const map: Record<string, ProcessingModel> = {
      scheduled: "scheduled",
      event: "queue",
      continuous: "continuous",
      manual: "manual",
    };
    requirements.processingModel = map[schedule];
    notes.push(
      note(
        "processingModel",
        requirements.processingModel ?? schedule,
        "inferred",
        "Mapped from when tasks should run.",
      ),
    );
  }

  const dataNeed = omitPreference(answers.workerDataNeed);
  if (dataNeed === "save-results" || dataNeed === "read-update") {
    requirements.databaseKind = "sql";
    requirements.capabilities = ["database"];
    notes.push(
      note("capabilities.database", "required", "explicit", "Worker needs lasting data access."),
    );
  }

  if (answers.workerQueueNeed === "yes") {
    notes.push(
      note(
        "queue",
        "requested",
        "explicit",
        "Queue preference noted — dedicated queue recipes are not available yet.",
      ),
    );
    if (!requirements.processingModel) {
      requirements.processingModel = "queue";
      notes.push(
        note("processingModel", "queue", "inferred", "Queue preference without schedule answer."),
      );
    }
  }

  if (answers.workerVolume && answers.workerVolume !== NO_PREFERENCE) {
    notes.push(
      note(
        "volume",
        answers.workerVolume,
        "explicit",
        "Volume is informational only and does not invent infrastructure.",
      ),
    );
  }

  return { ok: true, requirements, notes };
}

/**
 * Convert non-technical Discovery answers into engine `ProjectRequirements`.
 * Distinguishes explicit vs inferred fields via `notes` (for tests / future Developer Mode).
 */
export function resolveDiscoveryRequirements(answers: DiscoveryAnswers): ResolveDiscoveryResult {
  if (!answers.projectType) {
    return { ok: false, errors: ["Project type is required."] };
  }
  if (answers.projectType === "complete-product") {
    return { ok: false, errors: [formatUnsupportedProjectTypeMessage()] };
  }
  if (!isSupportedProjectType(answers.projectType)) {
    return { ok: false, errors: [`Unsupported project type '${answers.projectType}'.`] };
  }

  switch (answers.projectType) {
    case "ui":
      return resolveUi(answers);
    case "server-api":
      return resolveServer(answers);
    case "background-worker":
      return resolveWorker(answers);
  }
}
