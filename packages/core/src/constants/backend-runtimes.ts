/**
 * Runtimes behind Zealakit ecosystems (`EcosystemId` in types).
 * Bun/Deno are not registered — omit until supported.
 */
export const BACKEND_RUNTIMES = ["node", "go"] as const;

export type BackendRuntime = (typeof BACKEND_RUNTIMES)[number];
