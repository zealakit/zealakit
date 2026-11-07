/** What a Server/API service should accomplish (multi-select intent). */
export const SERVICE_GOALS = [
  "manage-accounts",
  "store-retrieve",
  "payments",
  "serve-clients",
  "connect-external",
  "business-operations",
  "other",
] as const;

export type ServiceGoal = (typeof SERVICE_GOALS)[number];
