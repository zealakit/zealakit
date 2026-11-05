/** Session outcomes persisted for local Discovery feedback (no PII). */
export const DISCOVERY_SESSION_STATUSES = [
  "completed",
  "cancelled",
  "no_match",
  "generation_failed",
] as const;

export type DiscoverySessionStatus = (typeof DISCOVERY_SESSION_STATUSES)[number];

/**
 * One Discovery attempt. IDs only — never project names, paths, answers, or env.
 */
export type DiscoverySessionRecord = {
  /** Opaque local id (not a project identifier). */
  id: string;
  /** ISO-8601 timestamp when the record was written. */
  recordedAt: string;
  status: DiscoverySessionStatus;
  /** Wall time from Discovery start until record, when known. */
  durationMs?: number;
  /** Ranked compatible template ids shown / produced by matching. */
  recommendedTemplateIds: string[];
  /** Template the user accepted, if any. */
  selectedTemplateId?: string;
  /** Default/recommended recipe ids for the selected (or top) template. */
  recommendedRecipeIds: string[];
  /** Recipes the user accepted (before auto-injected defaults may expand). */
  selectedRecipeIds: string[];
  /** True when the user departed from the initial top template or recipe set. */
  changedRecommendations: boolean;
  /** Whether matching produced at least one compatible template. */
  hadCompatibleTemplate: boolean;
  /** Set when generation was attempted. */
  generationSucceeded?: boolean;
};

export type DiscoveryFeedbackStore = {
  schemaVersion: 1;
  /** When false, new sessions are not appended (stats remain readable). */
  feedbackEnabled: boolean;
  sessions: DiscoverySessionRecord[];
};

/** In-progress session fields collected by the CLI before persistence. */
export type DiscoverySessionDraft = {
  startedAtMs: number;
  recommendedTemplateIds: string[];
  recommendedRecipeIds: string[];
  selectedTemplateId?: string;
  selectedRecipeIds: string[];
  changedRecommendations: boolean;
  hadCompatibleTemplate: boolean;
  status: Exclude<DiscoverySessionStatus, "completed" | "generation_failed">;
};

export type DiscoveryFeedbackStats = {
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  noMatchSessions: number;
  generationFailedSessions: number;
  generationAttempts: number;
  generationSuccessRate: number | null;
  recommendationChangeRate: number | null;
  firstTemplateOverrideRate: number | null;
  mostSelectedTemplates: Array<{ id: string; count: number }>;
  mostSelectedRecipes: Array<{ id: string; count: number }>;
  /** Diagnostic signals — not proof that scoring is wrong. */
  signals: string[];
};

export type DiscoveryFeedbackPaths = {
  /** User-level config directory for zealakit. */
  configDir: string;
  /** Versioned JSON store path. */
  storePath: string;
};

export type DiscoveryFeedbackStatusReport = {
  enabled: boolean;
  storePath: string;
  sessionCount: number;
};
