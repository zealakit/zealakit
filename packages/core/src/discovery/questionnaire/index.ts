export { normalizeDiscoveryAnswers } from "./normalize.js";
export {
  DISCOVERY_QUESTIONS,
  formatUnsupportedProjectTypeMessage,
  getQuestionOptions,
  getVisibleQuestions,
  pruneDiscoveryAnswers,
} from "./questions.js";
export {
  type RequirementProvenance,
  type ResolveDiscoveryResult,
  type ResolvedRequirementNote,
  resolveDiscoveryRequirements,
} from "./resolve.js";
export type {
  ApiAuthNeed,
  ApiBackgroundNeed,
  ApiStorageNeed,
  ApiTrafficExpectation,
  ContentChangeFrequency,
  DiscoveryAnswers,
  DiscoveryOption,
  DiscoveryQuestion,
  DiscoveryQuestionId,
  DiscoveryQuestionType,
  DiscoveryUiStack,
  NoPreference,
  ServiceConsumer,
  UiBackendApproach,
  UiDataNeed,
  UserAccountNeed,
  WorkerDataNeed,
  WorkerQueueNeed,
  WorkerSchedule,
  WorkerVolume,
} from "./types.js";
export {
  API_AUTH_NEEDS,
  API_BACKGROUND_NEEDS,
  API_STORAGE_NEEDS,
  API_TRAFFIC_EXPECTATIONS,
  CONTENT_CHANGE_FREQUENCIES,
  DISCOVERY_UI_STACKS,
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
export {
  type DiscoveryAnswerValidationOptions,
  validateDiscoveryAnswers,
} from "./validate.js";
