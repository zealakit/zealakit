import {
  ARCHITECTURE_LEVELS,
  BACKEND_FRAMEWORKS,
  BACKEND_RUNTIMES,
  type BackendFramework,
  type BackendRuntime,
  DATABASE_TYPES,
  DEPLOYMENT_TARGETS,
  FRONTEND_MODES,
  PROJECT_PURPOSES,
  PROJECT_TYPES,
  UI_FRAMEWORKS,
} from "../../constants.js";
import type { DiscoveryAnswers, DiscoveryOption, DiscoveryQuestion } from "./types.js";
import { NO_PREFERENCE } from "./types.js";

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

const NEEDS_FRONTEND = new Set(["website", "web-app", "fullstack"]);
const NEEDS_BACKEND = new Set(["api", "fullstack", "worker"]);

export const DISCOVERY_QUESTIONS: readonly DiscoveryQuestion[] = [
  {
    id: "projectType",
    prompt: "What kind of project are you building?",
    description: "We use this to shortlist matching starters.",
    type: "single-select",
    required: true,
    options: labeled(PROJECT_TYPES, {
      website: "Website",
      "web-app": "Web app",
      api: "API / backend service",
      fullstack: "Full-stack app",
      worker: "Background worker",
      unknown: "Not sure yet",
    }),
  },
  {
    id: "purpose",
    prompt: "What is it mainly for?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(PROJECT_PURPOSES, {
      saas: "SaaS product",
      business: "Business / company site",
      "internal-tool": "Internal tool",
      "developer-tool": "Developer tool",
      "api-service": "API service",
      ecommerce: "E-commerce",
      "content-platform": "Content / publishing",
      prototype: "Prototype",
      learning: "Learning / experiment",
      other: "Other",
    }),
  },
  {
    id: "frontendFramework",
    prompt: "Do you prefer a UI library?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(UI_FRAMEWORKS, {
      react: "React",
      vue: "Vue",
      svelte: "Svelte",
    }),
    condition: (answers) => Boolean(answers.projectType && NEEDS_FRONTEND.has(answers.projectType)),
  },
  {
    id: "frontendMode",
    prompt: "How should pages be rendered?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(FRONTEND_MODES, {
      spa: "In the browser (SPA)",
      ssg: "Pre-built static pages (SSG)",
      ssr: "Rendered on the server (SSR)",
      islands: "Mostly static with interactive islands",
      static: "Fully static",
    }),
    // Ask whenever the project needs a UI — even if the library is "no preference".
    condition: (answers) => Boolean(answers.projectType && NEEDS_FRONTEND.has(answers.projectType)),
  },
  {
    id: "backendRuntime",
    prompt: "Do you prefer a backend runtime?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(BACKEND_RUNTIMES, {
      node: "Node.js",
      go: "Go",
    }),
    condition: (answers) => Boolean(answers.projectType && NEEDS_BACKEND.has(answers.projectType)),
  },
  {
    id: "backendFramework",
    prompt: "Do you prefer a backend framework?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(BACKEND_FRAMEWORKS, {
      nest: "NestJS",
      hono: "Hono",
      gin: "Gin",
      stdlib: "Go standard library",
    }),
    condition: (answers) =>
      Boolean(
        answers.backendRuntime &&
          answers.backendRuntime !== NO_PREFERENCE &&
          answers.projectType &&
          NEEDS_BACKEND.has(answers.projectType),
      ),
  },
  {
    id: "capabilities",
    prompt: "Anything else you need?",
    description: "Leave empty if you are unsure — we will not add extras.",
    type: "multi-select",
    required: false,
    options: [
      { value: "database", label: "Save data in a database", hint: "Adds an ORM recipe" },
      {
        value: "external-api",
        label: "Call other HTTP APIs",
        hint: "Adds an HTTP client recipe",
      },
    ],
  },
  {
    id: "databases",
    prompt: "Which database should we target?",
    type: "multi-select",
    required: false,
    options: labeled(DATABASE_TYPES, {
      postgresql: "PostgreSQL",
      mysql: "MySQL",
      sqlite: "SQLite",
    }),
    condition: (answers) => Boolean(answers.capabilities?.includes("database")),
  },
  {
    id: "deploymentTarget",
    prompt: "Where do you plan to host it?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(DEPLOYMENT_TARGETS, {
      vps: "VPS / virtual machine",
      container: "Container",
      serverless: "Serverless",
      "static-hosting": "Static hosting",
    }),
  },
  {
    id: "architectureLevel",
    prompt: "How much project structure do you want?",
    type: "single-select",
    required: false,
    allowNoPreference: true,
    options: labeled(ARCHITECTURE_LEVELS, {
      minimal: "Minimal — keep it simple",
      balanced: "Balanced",
      structured: "Structured — clear layers",
    }),
  },
];

const FRAMEWORKS_BY_RUNTIME: Record<BackendRuntime, readonly BackendFramework[]> = {
  node: ["nest", "hono"],
  go: ["gin", "stdlib"],
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
  const allowed = new Set(FRAMEWORKS_BY_RUNTIME[runtime]);
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
