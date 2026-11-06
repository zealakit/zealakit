import type {
  ApiTrafficExpectation,
  BackendFramework,
  BackendRuntime,
  ProjectType,
  ServiceGoal,
  VisitorAction,
  WebsiteKind,
  WorkerTask,
} from "../../constants.js";

/** Sentinel for optional single-select "no preference" / "recommend for me" answers. */
export const NO_PREFERENCE = "no-preference" as const;
export type NoPreference = typeof NO_PREFERENCE;

/** UI stack choices (includes Astro; Svelte listed but not templated yet). */
export const DISCOVERY_UI_STACKS = ["react", "vue", "svelte", "astro"] as const;
export type DiscoveryUiStack = (typeof DISCOVERY_UI_STACKS)[number];

/** Whether visitors need accounts on a UI. */
export const USER_ACCOUNT_NEEDS = ["public", "sign-in", "roles"] as const;
export type UserAccountNeed = (typeof USER_ACCOUNT_NEEDS)[number];

/** Whether a UI needs to keep information over time. */
export const UI_DATA_NEEDS = ["predefined", "store-retrieve", "user-managed"] as const;
export type UiDataNeed = (typeof UI_DATA_NEEDS)[number];

/**
 * How a UI with accounts/data should get its backend services.
 * Distinguishes consuming an existing API from embedding server capability in this project.
 */
export const UI_BACKEND_APPROACHES = ["existing-api", "ui-only", "include-server"] as const;
export type UiBackendApproach = (typeof UI_BACKEND_APPROACHES)[number];

/** How often UI content changes (infers rendering; never shown as SPA/SSR jargon). */
export const CONTENT_CHANGE_FREQUENCIES = [
  "rarely",
  "occasionally",
  "frequently",
  "realtime",
] as const;
export type ContentChangeFrequency = (typeof CONTENT_CHANGE_FREQUENCIES)[number];

/** Who will call a Server/API service. */
export const SERVICE_CONSUMERS = [
  "own-website",
  "mobile-app",
  "other-backends",
  "external-developers",
  "multiple",
] as const;
export type ServiceConsumer = (typeof SERVICE_CONSUMERS)[number];

/** Server/API storage intent (plain language → sql/nosql later). */
export const API_STORAGE_NEEDS = ["none", "relational", "flexible", "both"] as const;
export type ApiStorageNeed = (typeof API_STORAGE_NEEDS)[number];

/** Server/API auth intent (informational until auth recipes exist). */
export const API_AUTH_NEEDS = ["no", "basic", "roles", "service"] as const;
export type ApiAuthNeed = (typeof API_AUTH_NEEDS)[number];

/** Whether an API also needs background work (does not invent multi-project generation). */
export const API_BACKGROUND_NEEDS = ["no", "background", "queue"] as const;
export type ApiBackgroundNeed = (typeof API_BACKGROUND_NEEDS)[number];

/**
 * Re-export traffic levels for questionnaire typing.
 * Canonical values live in `constants/api-traffic-expectations.ts`.
 */
export type { ApiTrafficExpectation } from "../../constants.js";
export { API_TRAFFIC_EXPECTATIONS } from "../../constants.js";

/** When worker tasks should run. */
export const WORKER_SCHEDULES = ["scheduled", "event", "continuous", "manual"] as const;
export type WorkerSchedule = (typeof WORKER_SCHEDULES)[number];

/** Rough task volume (soft signal only — does not invent infrastructure). */
export const WORKER_VOLUMES = ["few", "many", "large"] as const;
export type WorkerVolume = (typeof WORKER_VOLUMES)[number];

/** Whether worker tasks touch persistent data. */
export const WORKER_DATA_NEEDS = ["none", "save-results", "read-update"] as const;
export type WorkerDataNeed = (typeof WORKER_DATA_NEEDS)[number];

/** Whether the user wants queue-style processing. */
export const WORKER_QUEUE_NEEDS = ["no", "yes"] as const;
export type WorkerQueueNeed = (typeof WORKER_QUEUE_NEEDS)[number];

export type DiscoveryQuestionType = "single-select" | "multi-select";

export type DiscoveryOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
};

/**
 * Partial answers from the non-technical questionnaire.
 * Omitted keys / `NO_PREFERENCE` mean unanswered optional prefs — not hard negatives.
 */
export type DiscoveryAnswers = {
  projectType?: ProjectType;

  // UI
  websiteKind?: WebsiteKind | NoPreference;
  visitorActions?: VisitorAction[];
  userAccounts?: UserAccountNeed | NoPreference;
  uiDataNeed?: UiDataNeed | NoPreference;
  uiBackendApproach?: UiBackendApproach | NoPreference;
  contentChangeFrequency?: ContentChangeFrequency | NoPreference;
  uiTechPreference?: DiscoveryUiStack | NoPreference;

  // Server / API
  serviceGoals?: ServiceGoal[];
  serviceConsumers?: ServiceConsumer | NoPreference;
  apiStorageNeed?: ApiStorageNeed | NoPreference;
  apiAuthNeed?: ApiAuthNeed | NoPreference;
  apiBackgroundNeed?: ApiBackgroundNeed | NoPreference;
  /** Expected request volume / concurrency (not merely registered user count). */
  apiTrafficExpectation?: ApiTrafficExpectation | NoPreference;
  backendRuntime?: BackendRuntime | NoPreference;
  backendFramework?: BackendFramework | NoPreference;

  // Worker
  workerTasks?: WorkerTask[];
  workerSchedule?: WorkerSchedule | NoPreference;
  workerVolume?: WorkerVolume | NoPreference;
  workerDataNeed?: WorkerDataNeed | NoPreference;
  workerQueueNeed?: WorkerQueueNeed | NoPreference;
};

export type DiscoveryQuestionId = keyof DiscoveryAnswers;

export type DiscoveryQuestion = {
  id: DiscoveryQuestionId;
  prompt: string;
  description?: string;
  type: DiscoveryQuestionType;
  required: boolean;
  options: DiscoveryOption[];
  allowNoPreference?: boolean;
  noPreferenceLabel?: string;
  condition?: (answers: DiscoveryAnswers) => boolean;
};
