/**
 * How much structure Discovery should prefer
 * (e.g. minimal stdlib vs structured Nest/Hono DDD starters).
 */
export const ARCHITECTURE_LEVELS = ["minimal", "balanced", "structured"] as const;

export type ArchitectureLevel = (typeof ARCHITECTURE_LEVELS)[number];
