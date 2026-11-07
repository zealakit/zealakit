/** Background work the user wants automated (multi-select intent). */
export const WORKER_TASKS = [
  "emails-notifications",
  "process-files",
  "synchronize-data",
  "generate-reports",
  "process-orders",
  "scheduled-maintenance",
  "other",
] as const;

export type WorkerTask = (typeof WORKER_TASKS)[number];
