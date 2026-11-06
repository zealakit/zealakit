/**
 * Root Discovery project kinds (decision-tree branches).
 * Distinct from template `Scope` (`client` | `server` | `hybrid` | `infrastructure`).
 *
 * `complete-product` is represented but not recommendable in this release.
 * It is a product-scope choice — not an architecture or multi-directory topology.
 */
export const PROJECT_TYPES = ["ui", "server-api", "background-worker", "complete-product"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Project types with a completed Discovery questionnaire + matching path. */
export const SUPPORTED_PROJECT_TYPES = ["ui", "server-api", "background-worker"] as const;

export type SupportedProjectType = (typeof SUPPORTED_PROJECT_TYPES)[number];

export function isSupportedProjectType(value: ProjectType): value is SupportedProjectType {
  return (SUPPORTED_PROJECT_TYPES as readonly string[]).includes(value);
}
