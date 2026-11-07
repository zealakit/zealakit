import fs from "node:fs";
import path from "node:path";
import { resolveDiscoveryFeedbackPaths } from "./paths.js";
import type {
  DiscoveryFeedbackStore,
  DiscoverySessionDraft,
  DiscoverySessionRecord,
  DiscoverySessionStatus,
} from "./types.js";

export const DISCOVERY_FEEDBACK_SCHEMA_VERSION = 1 as const;
/** Keep the newest N sessions; older entries are dropped on write. */
export const DISCOVERY_FEEDBACK_MAX_SESSIONS = 100;

const FEEDBACK_ENV = "ZEALAKIT_DISCOVERY_FEEDBACK";

function emptyStore(): DiscoveryFeedbackStore {
  return {
    schemaVersion: DISCOVERY_FEEDBACK_SCHEMA_VERSION,
    feedbackEnabled: true,
    sessions: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseSession(value: unknown): DiscoverySessionRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.recordedAt !== "string") return null;
  if (typeof value.status !== "string") return null;
  if (!isStringArray(value.recommendedTemplateIds) || !isStringArray(value.recommendedRecipeIds)) {
    return null;
  }
  if (!isStringArray(value.selectedRecipeIds)) return null;
  if (typeof value.changedRecommendations !== "boolean") return null;
  if (typeof value.hadCompatibleTemplate !== "boolean") return null;

  const session: DiscoverySessionRecord = {
    id: value.id,
    recordedAt: value.recordedAt,
    status: value.status as DiscoverySessionStatus,
    recommendedTemplateIds: value.recommendedTemplateIds,
    recommendedRecipeIds: value.recommendedRecipeIds,
    selectedRecipeIds: value.selectedRecipeIds,
    changedRecommendations: value.changedRecommendations,
    hadCompatibleTemplate: value.hadCompatibleTemplate,
  };

  if (typeof value.durationMs === "number" && Number.isFinite(value.durationMs)) {
    session.durationMs = value.durationMs;
  }
  if (typeof value.selectedTemplateId === "string") {
    session.selectedTemplateId = value.selectedTemplateId;
  }
  if (typeof value.generationSucceeded === "boolean") {
    session.generationSucceeded = value.generationSucceeded;
  }
  return session;
}

/** Parse store JSON; corrupt / unknown versions yield a fresh empty store. */
export function parseDiscoveryFeedbackStore(raw: string): DiscoveryFeedbackStore {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyStore();
    if (parsed.schemaVersion !== DISCOVERY_FEEDBACK_SCHEMA_VERSION) return emptyStore();

    const sessions: DiscoverySessionRecord[] = [];
    if (Array.isArray(parsed.sessions)) {
      for (const entry of parsed.sessions) {
        const session = parseSession(entry);
        if (session) sessions.push(session);
      }
    }

    return {
      schemaVersion: DISCOVERY_FEEDBACK_SCHEMA_VERSION,
      feedbackEnabled: parsed.feedbackEnabled !== false,
      sessions,
    };
  } catch {
    return emptyStore();
  }
}

export function trimDiscoverySessions(
  sessions: DiscoverySessionRecord[],
  max = DISCOVERY_FEEDBACK_MAX_SESSIONS,
): DiscoverySessionRecord[] {
  if (sessions.length <= max) return sessions;
  return sessions.slice(sessions.length - max);
}

function envDisablesFeedback(env: NodeJS.ProcessEnv): boolean {
  const raw = env[FEEDBACK_ENV]?.trim().toLowerCase();
  return raw === "0" || raw === "false" || raw === "off" || raw === "no";
}

export type DiscoveryFeedbackStoreOptions = {
  storePath?: string;
  env?: NodeJS.ProcessEnv;
};

function resolveStorePath(options: DiscoveryFeedbackStoreOptions = {}): string {
  if (options.storePath) return options.storePath;
  return resolveDiscoveryFeedbackPaths(options.env ?? process.env).storePath;
}

/** Read store; missing or corrupt files become an empty in-memory store. */
export function loadDiscoveryFeedbackStore(
  options: DiscoveryFeedbackStoreOptions = {},
): DiscoveryFeedbackStore {
  const storePath = resolveStorePath(options);
  try {
    if (!fs.existsSync(storePath)) return emptyStore();
    return parseDiscoveryFeedbackStore(fs.readFileSync(storePath, "utf8"));
  } catch {
    return emptyStore();
  }
}

/**
 * Persist store. Returns false on failure — callers must never fail scaffolding on this.
 */
export function saveDiscoveryFeedbackStore(
  store: DiscoveryFeedbackStore,
  options: DiscoveryFeedbackStoreOptions = {},
): boolean {
  const storePath = resolveStorePath(options);
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const payload: DiscoveryFeedbackStore = {
      schemaVersion: DISCOVERY_FEEDBACK_SCHEMA_VERSION,
      feedbackEnabled: store.feedbackEnabled,
      sessions: trimDiscoverySessions(store.sessions),
    };
    const tmp = `${storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, storePath);
    return true;
  } catch {
    return false;
  }
}

/** Whether new session records should be written. */
export function isDiscoveryFeedbackEnabled(options: DiscoveryFeedbackStoreOptions = {}): boolean {
  const env = options.env ?? process.env;
  if (envDisablesFeedback(env)) return false;
  return loadDiscoveryFeedbackStore(options).feedbackEnabled;
}

export function setDiscoveryFeedbackEnabled(
  enabled: boolean,
  options: DiscoveryFeedbackStoreOptions = {},
): boolean {
  const store = loadDiscoveryFeedbackStore(options);
  store.feedbackEnabled = enabled;
  return saveDiscoveryFeedbackStore(store, options);
}

export function clearDiscoveryFeedbackSessions(
  options: DiscoveryFeedbackStoreOptions = {},
): boolean {
  const store = loadDiscoveryFeedbackStore(options);
  store.sessions = [];
  return saveDiscoveryFeedbackStore(store, options);
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  if (left.size !== a.length) {
    // Multisets: fall back to sorted compare
    return [...a].sort().join("\0") === [...b].sort().join("\0");
  }
  return b.every((id) => left.has(id));
}

export function didChangeDiscoveryRecommendations(input: {
  recommendedTemplateIds: string[];
  selectedTemplateId?: string;
  recommendedRecipeIds: string[];
  selectedRecipeIds: string[];
}): boolean {
  const top = input.recommendedTemplateIds[0];
  if (input.selectedTemplateId && top && input.selectedTemplateId !== top) {
    return true;
  }
  if (!sameIdSet(input.recommendedRecipeIds, input.selectedRecipeIds)) {
    return true;
  }
  return false;
}

function createSessionId(): string {
  return `dfs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildDiscoverySessionRecord(
  draft: DiscoverySessionDraft,
  extras: {
    status?: DiscoverySessionStatus;
    generationSucceeded?: boolean;
    nowMs?: number;
  } = {},
): DiscoverySessionRecord {
  const nowMs = extras.nowMs ?? Date.now();
  const status = extras.status ?? draft.status;
  const record: DiscoverySessionRecord = {
    id: createSessionId(),
    recordedAt: new Date(nowMs).toISOString(),
    status,
    durationMs: Math.max(0, nowMs - draft.startedAtMs),
    recommendedTemplateIds: [...draft.recommendedTemplateIds],
    recommendedRecipeIds: [...draft.recommendedRecipeIds],
    selectedRecipeIds: [...draft.selectedRecipeIds],
    changedRecommendations: draft.changedRecommendations,
    hadCompatibleTemplate: draft.hadCompatibleTemplate,
  };
  if (draft.selectedTemplateId) {
    record.selectedTemplateId = draft.selectedTemplateId;
  }
  if (typeof extras.generationSucceeded === "boolean") {
    record.generationSucceeded = extras.generationSucceeded;
  }
  return record;
}

/**
 * Append a session when feedback is enabled. Never throws; returns false on skip/failure.
 */
export function recordDiscoverySession(
  draft: DiscoverySessionDraft,
  extras: {
    status?: DiscoverySessionStatus;
    generationSucceeded?: boolean;
  } = {},
  options: DiscoveryFeedbackStoreOptions = {},
): boolean {
  try {
    if (!isDiscoveryFeedbackEnabled(options)) return false;
    const store = loadDiscoveryFeedbackStore(options);
    store.sessions.push(buildDiscoverySessionRecord(draft, extras));
    return saveDiscoveryFeedbackStore(store, options);
  } catch {
    return false;
  }
}

export { FEEDBACK_ENV };
