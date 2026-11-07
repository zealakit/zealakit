/**
 * Scaffolding ecosystems. Each ecosystem contributes templates/recipes and one
 * `ManifestAdapter`; the CLI registers them at startup.
 */
export const ECOSYSTEMS = ["node", "go"] as const;

export type EcosystemId = (typeof ECOSYSTEMS)[number];

/** Human-readable ecosystem labels (used by `zealakit info`, not by scaffolding). */
export const ECOSYSTEM_LABELS: Record<EcosystemId, string> = {
  node: "Node.js",
  go: "Go",
};
