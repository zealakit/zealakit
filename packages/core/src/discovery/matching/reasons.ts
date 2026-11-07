import type { MatchReason } from "./types.js";

/** Stable reason codes for CLI / UI rendering. */
export const REASON_CODES = {
  projectTypeMatch: "project-type-match",
  projectTypeMismatch: "project-type-mismatch",
  scopeMatch: "scope-match",
  scopeMismatch: "scope-mismatch",
  capabilityMatch: "capability-match",
  capabilityMissing: "capability-missing",
  capabilityRedundant: "capability-redundant",
  runtimeMatch: "runtime-match",
  runtimeMismatch: "runtime-mismatch",
  backendFrameworkMatch: "backend-framework-match",
  backendFrameworkMismatch: "backend-framework-mismatch",
  frontendFrameworkMatch: "frontend-framework-match",
  frontendFrameworkMismatch: "frontend-framework-mismatch",
  frontendModeMatch: "frontend-mode-match",
  frontendModeMismatch: "frontend-mode-mismatch",
  architectureMatch: "architecture-match",
  architectureMismatch: "architecture-mismatch",
  deploymentMatch: "deployment-match",
  deploymentMismatch: "deployment-mismatch",
  purposeMatch: "purpose-match",
  recipeRequires: "recipe-requires",
  recipeExcludes: "recipe-excludes",
  recipeConflict: "recipe-conflict",
  recipeDependencyMissing: "recipe-dependency-missing",
  recipeDependency: "recipe-dependency",
  templateCompat: "template-compat",
  templateIncompat: "template-incompat",
  notRelevant: "not-relevant",
  databaseMatch: "database-match",
  simplicity: "simplicity",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

export function reason(code: ReasonCode, message: string, weight?: number): MatchReason {
  return weight === undefined ? { code, message } : { code, message, weight };
}
