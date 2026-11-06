import {
  BACKEND_FRAMEWORKS,
  BACKEND_RUNTIMES,
  type BackendFramework,
  type BackendRuntime,
  PROJECT_TYPES,
  SERVICE_GOALS,
  VISITOR_ACTIONS,
  WEBSITE_KINDS,
  WORKER_TASKS,
} from "../../constants.js";
import {
  API_AUTH_NEEDS,
  API_BACKGROUND_NEEDS,
  API_STORAGE_NEEDS,
  API_TRAFFIC_EXPECTATIONS,
  CONTENT_CHANGE_FREQUENCIES,
  DISCOVERY_UI_STACKS,
  type DiscoveryAnswers,
  type DiscoveryOption,
  type DiscoveryQuestion,
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

function labeled<T extends string>(
  values: readonly T[],
  labels: Partial<Record<T, string>> = {},
  hints: Partial<Record<T, string>> = {},
): DiscoveryOption<T>[] {
  return values.map((value) => ({
    value,
    label: labels[value] ?? value,
    ...(hints[value] ? { hint: hints[value] } : {}),
  }));
}

const isUi = (answers: DiscoveryAnswers) => answers.projectType === "ui";
const isServer = (answers: DiscoveryAnswers) => answers.projectType === "server-api";
const isWorker = (answers: DiscoveryAnswers) => answers.projectType === "background-worker";

/** Website kinds that typically need accounts / managed data follow-ups. */
const INTERACTIVE_UI = new Set(["management-dashboard", "online-store", "interactive-tool"]);

export const DISCOVERY_QUESTIONS: readonly DiscoveryQuestion[] = [
  {
    id: "projectType",
    prompt: "What do you want to create?",
    description:
      "Choose one component to start with, or a complete product when that path is available.",
    type: "single-select",
    required: true,
    options: labeled(
      PROJECT_TYPES,
      {
        ui: "UI / Website",
        "server-api": "Backend / API Service",
        "background-worker": "Background / Worker",
        "complete-product": "Complete Product",
      },
      {
        ui: "The visual part people interact with — business site, landing page, blog, dashboard, or store",
        "server-api":
          "A service for data, business logic, and requests — users, bookings, payments",
        "background-worker": "Automatic background work — emails, file processing, scheduled jobs",
        "complete-product":
          "Coming soon — an entire product, from a simple website to connected services",
      },
    ),
  },

  // ── UI ─────────────────────────────────────────────────────
  {
    id: "websiteKind",
    prompt: "What kind of website are you building?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(
      WEBSITE_KINDS,
      {
        "business-marketing": "Business or marketing website",
        "landing-page": "Landing page",
        "blog-content": "Blog or content website",
        portfolio: "Portfolio",
        "management-dashboard": "Management dashboard",
        "online-store": "Online store",
        "interactive-tool": "Interactive web tool",
        other: "Something else",
      },
      {
        "business-marketing": "Company pages, services, and contact info",
        "landing-page": "A focused page to explain an offer or collect interest",
        "blog-content": "Articles, guides, or publishing",
        portfolio: "Showcase work or personal projects",
        "management-dashboard": "Internal tools to view and manage information",
        "online-store": "Products, carts, and checkout-style flows",
        "interactive-tool": "Calculators, builders, or other interactive experiences",
        other: "Tell us more through the next questions",
      },
    ),
    condition: isUi,
  },
  {
    id: "visitorActions",
    prompt: "What should visitors be able to do?",
    description: "Select all that apply. Leave empty if you are unsure.",
    type: "multi-select",
    required: false,
    options: labeled(
      VISITOR_ACTIONS,
      {
        "read-information": "Read information",
        "browse-catalog": "Browse products or services",
        "submit-forms": "Submit forms",
        "sign-in": "Sign in to an account",
        "manage-information": "Manage their own information",
        "upload-files": "Upload files",
        "use-interactive-tools": "Use interactive tools",
        "make-purchases": "Make purchases",
        "call-existing-api": "Use an API or service that already exists",
      },
      {
        "call-existing-api":
          "Your site talks to a backend you already have — we will not invent a new one",
      },
    ),
    condition: isUi,
  },
  {
    id: "userAccounts",
    prompt: "Does your website need user accounts?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(USER_ACCOUNT_NEEDS, {
      public: "No — visitors can access everything publicly",
      "sign-in": "Yes — users need to sign in",
      roles: "Yes — different users have different permissions",
    }),
    condition: (answers) =>
      Boolean(
        isUi(answers) &&
          (INTERACTIVE_UI.has(answers.websiteKind as string) ||
            answers.visitorActions?.some((action) =>
              ["sign-in", "manage-information", "make-purchases"].includes(action),
            )),
      ),
  },
  {
    id: "uiDataNeed",
    prompt: "Does your website need to save information?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(
      UI_DATA_NEEDS,
      {
        predefined: "No — content can be predefined",
        "store-retrieve": "Yes — information must be stored and retrieved",
        "user-managed": "Yes — users need to manage their own information",
      },
      {
        predefined: "Pages and content are mostly fixed when you publish",
        "store-retrieve": "Needs a place to keep data over time",
        "user-managed": "People create or edit their own records",
      },
    ),
    condition: (answers) =>
      Boolean(
        isUi(answers) &&
          (INTERACTIVE_UI.has(answers.websiteKind as string) ||
            answers.visitorActions?.some((action) =>
              ["manage-information", "submit-forms", "make-purchases", "upload-files"].includes(
                action,
              ),
            ) ||
            answers.userAccounts === "sign-in" ||
            answers.userAccounts === "roles"),
      ),
  },
  {
    id: "uiBackendApproach",
    prompt: "Where should accounts or saved data live?",
    description:
      "A website can talk to a service you already have. Choosing a built-in server here is only for this single project.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure — recommend a UI I can connect later",
    options: labeled(
      UI_BACKEND_APPROACHES,
      {
        "existing-api": "Use an API or backend that already exists",
        "ui-only": "Build the website UI now; add or connect a backend later",
        "include-server": "Include server / data features in this project",
      },
      {
        "existing-api": "Vite-style apps stay available — we will not invent a new backend",
        "ui-only": "Start with a client UI; Complete Product can add backends later",
        "include-server": "Prefer starters that can host API or data layers in the same project",
      },
    ),
    condition: (answers) =>
      Boolean(
        isUi(answers) &&
          (answers.uiDataNeed === "store-retrieve" ||
            answers.uiDataNeed === "user-managed" ||
            answers.userAccounts === "sign-in" ||
            answers.userAccounts === "roles" ||
            answers.visitorActions?.includes("call-existing-api") ||
            answers.visitorActions?.includes("manage-information")),
      ),
  },
  {
    id: "contentChangeFrequency",
    prompt: "How often does your website content change?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(CONTENT_CHANGE_FREQUENCIES, {
      rarely: "Rarely — mostly fixed content",
      occasionally: "Occasionally — updated by hand",
      frequently: "Frequently — people update content often",
      realtime: "Continuously — information changes in real time",
    }),
    condition: isUi,
  },
  {
    id: "uiTechPreference",
    prompt: "Do you have a preferred technology? (optional)",
    description: "Skip this if you want Zealakit to recommend a good default.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "No preference — recommend for me",
    options: labeled(
      DISCOVERY_UI_STACKS,
      {
        react: "React",
        vue: "Vue",
        svelte: "Svelte",
        astro: "Astro",
      },
      {
        react: "Popular for dashboards and interactive apps",
        vue: "Popular for interactive apps and Nuxt sites",
        svelte: "Not available in current starters yet",
        astro: "Great for content-heavy and mostly static sites",
      },
    ),
    condition: isUi,
  },

  // ── Server / API ───────────────────────────────────────────
  {
    id: "serviceGoals",
    prompt: "What will your service do?",
    description: "Select all that apply.",
    type: "multi-select",
    required: false,
    options: labeled(SERVICE_GOALS, {
      "manage-accounts": "Manage user accounts",
      "store-retrieve": "Store and retrieve information",
      payments: "Handle payments or transactions",
      "serve-clients": "Provide data to a website or app",
      "connect-external": "Connect with external services",
      "business-operations": "Process business operations",
      other: "Something else",
    }),
    condition: isServer,
  },
  {
    id: "serviceConsumers",
    prompt: "Who will use this service?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(SERVICE_CONSUMERS, {
      "own-website": "My own website",
      "mobile-app": "A mobile application",
      "other-backends": "Other backend services",
      "external-developers": "External developers or customers",
      multiple: "Several types of applications",
    }),
    condition: isServer,
  },
  {
    id: "apiStorageNeed",
    prompt: "Does your service need to store information?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(
      API_STORAGE_NEEDS,
      {
        none: "No lasting storage needed",
        relational: "Yes — structured data like users, orders, or records",
        flexible: "Yes — flexible documents or less structured data",
        both: "Yes — both structured and flexible data",
      },
      {
        flexible: "Document-style storage is not available in current starters yet",
        both: "We can start with structured data; document storage is limited today",
      },
    ),
    condition: isServer,
  },
  {
    id: "apiAuthNeed",
    prompt: "Does your service need sign-in or permissions?",
    description: "We note this for guidance; dedicated auth packages are not shipped yet.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(API_AUTH_NEEDS, {
      no: "No",
      basic: "Yes — basic user sign-in",
      roles: "Yes — roles and permissions",
      service: "Yes — other services need to authenticate",
    }),
    condition: (answers) =>
      Boolean(
        isServer(answers) &&
          (answers.serviceGoals?.includes("manage-accounts") ||
            answers.apiStorageNeed === "relational" ||
            answers.apiStorageNeed === "both"),
      ),
  },
  {
    id: "apiBackgroundNeed",
    prompt: "Does your service need to handle background work?",
    description:
      "Background jobs may need a separate worker later. This release recommends an API starter only.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(API_BACKGROUND_NEEDS, {
      no: "No — requests can finish right away",
      background: "Yes — some work should continue after the response",
      queue: "Yes — work should wait in a queue",
    }),
    condition: isServer,
  },
  {
    id: "apiTrafficExpectation",
    prompt: "How much traffic do you expect your service to handle?",
    description:
      "Traffic means request volume and concurrency (how many requests happen at once), not only how many users are registered.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure — recommend for me",
    options: labeled(
      API_TRAFFIC_EXPECTATIONS,
      {
        low: "Low — Small number of users",
        medium: "Medium — Growing user base",
        high: "High — Heavy traffic and concurrency",
        "very-high": "Very high — Performance-critical workload",
      },
      {
        low: "Light request volume; a simple API starter is usually enough",
        medium: "Steady growth in concurrent requests",
        high: "Busy services may benefit from Go alternatives",
        "very-high": "Performance-sensitive workloads often prefer Go starters",
      },
    ),
    condition: isServer,
  },
  {
    id: "backendRuntime",
    prompt: "Do you have a preferred technology? (optional)",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "No preference — recommend for me",
    options: labeled(
      BACKEND_RUNTIMES,
      {
        node: "TypeScript",
        go: "Go",
      },
      {
        node: "NestJS or Hono starters",
        go: "Go standard library or Gin starters",
      },
    ),
    condition: (answers) => isServer(answers) || isWorker(answers),
  },
  {
    id: "backendFramework",
    prompt: "Any framework preference? (optional)",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Recommend for me",
    options: labeled(BACKEND_FRAMEWORKS, {
      nest: "NestJS",
      hono: "Hono",
      gin: "Gin",
      stdlib: "Go standard library",
    }),
    condition: (answers) =>
      Boolean(
        (isServer(answers) || isWorker(answers)) &&
          answers.backendRuntime &&
          answers.backendRuntime !== NO_PREFERENCE,
      ),
  },

  // ── Worker ─────────────────────────────────────────────────
  {
    id: "workerTasks",
    prompt: "What tasks should run in the background?",
    description: "Select all that apply.",
    type: "multi-select",
    required: false,
    options: labeled(WORKER_TASKS, {
      "emails-notifications": "Send emails or notifications",
      "process-files": "Process uploaded files",
      "synchronize-data": "Synchronize information",
      "generate-reports": "Generate reports",
      "process-orders": "Process orders or transactions",
      "scheduled-maintenance": "Perform scheduled maintenance",
      other: "Something else",
    }),
    condition: isWorker,
  },
  {
    id: "workerSchedule",
    prompt: "When should these tasks run?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(WORKER_SCHEDULES, {
      scheduled: "At specific times",
      event: "When something happens",
      continuous: "Continuously",
      manual: "When someone starts them",
    }),
    condition: isWorker,
  },
  {
    id: "workerVolume",
    prompt: "How many tasks do you expect?",
    description: "A rough sense is enough — we will not invent complex infrastructure.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(WORKER_VOLUMES, {
      few: "A few tasks occasionally",
      many: "Many tasks regularly",
      large: "A large volume of tasks",
    }),
    condition: isWorker,
  },
  {
    id: "workerDataNeed",
    prompt: "Do tasks need to save results or use existing data?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure",
    options: labeled(WORKER_DATA_NEEDS, {
      none: "No — processing is temporary",
      "save-results": "Yes — save processing results",
      "read-update": "Yes — read or update existing application data",
    }),
    condition: isWorker,
  },
  {
    id: "workerQueueNeed",
    prompt: "Should tasks wait in a queue?",
    description: "Queue integrations are limited in current starters.",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    noPreferenceLabel: "Not sure — recommend for me",
    options: labeled(WORKER_QUEUE_NEEDS, {
      no: "No",
      yes: "Yes",
    }),
    condition: isWorker,
  },
];

const FRAMEWORKS_BY_RUNTIME: Record<BackendRuntime, readonly BackendFramework[]> = {
  node: ["nest", "hono"],
  go: ["gin", "stdlib"],
};

const WORKER_FRAMEWORKS_BY_RUNTIME: Partial<Record<BackendRuntime, readonly BackendFramework[]>> = {
  go: ["stdlib"],
};

/** Questions visible for the current answers (conditions re-evaluated). */
export function getVisibleQuestions(answers: DiscoveryAnswers): DiscoveryQuestion[] {
  return DISCOVERY_QUESTIONS.filter(
    (question) => !question.condition || question.condition(answers),
  );
}

/** Options for a question, narrowed by prior answers when needed. */
export function getQuestionOptions(
  question: DiscoveryQuestion,
  answers: DiscoveryAnswers,
): DiscoveryOption[] {
  if (question.id !== "backendFramework") {
    return question.options;
  }
  const runtime = answers.backendRuntime;
  if (!runtime || runtime === NO_PREFERENCE) {
    return question.options;
  }
  const allowed = new Set(
    isWorker(answers)
      ? (WORKER_FRAMEWORKS_BY_RUNTIME[runtime] ?? [])
      : FRAMEWORKS_BY_RUNTIME[runtime],
  );
  return question.options.filter((option) => allowed.has(option.value as BackendFramework));
}

/** Drop answers for questions that are no longer visible. */
export function pruneDiscoveryAnswers(answers: DiscoveryAnswers): DiscoveryAnswers {
  const visible = new Set(getVisibleQuestions(answers).map((question) => question.id));
  const next: DiscoveryAnswers = {};
  for (const question of DISCOVERY_QUESTIONS) {
    if (!visible.has(question.id)) {
      continue;
    }
    const value = answers[question.id];
    if (value !== undefined) {
      (next as Record<string, unknown>)[question.id] = value;
    }
  }
  return next;
}

/** Human message when Complete Product is selected. */
export function formatUnsupportedProjectTypeMessage(): string {
  return [
    "Complete Product is not supported yet.",
    "A future release will help you create an entire product — from a simple website to systems with several connected parts.",
    "For now, create a UI / website, backend / API service, or background / worker separately.",
  ].join("\n");
}
