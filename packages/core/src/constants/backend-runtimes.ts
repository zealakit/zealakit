/**
 * Runtimes behind Zealakit ecosystems (`EcosystemId` in types).
 * Bun/Deno are not registered — omit until supported.
 */
export const BACKEND_RUNTIMES = ["node", "go"] as const;

export type BackendRuntime = (typeof BACKEND_RUNTIMES)[number];

/**
 * Soft default backend ecosystem preference when Discovery has no explicit runtime choice.
 * Ranking only — never a hard eligibility filter. Node/TypeScript first; Go secondary.
 */
export const DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE = ["node", "go"] as const;

export type DefaultBackendEcosystemPreference =
  (typeof DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE)[number];
