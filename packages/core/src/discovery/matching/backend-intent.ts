import {
  API_TRAFFIC_EXPECTATIONS,
  type ApiTrafficExpectation,
  type BackendFramework,
  type BackendRuntime,
  DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE,
} from "../../constants.js";
import type { ResolvedTemplateProfile } from "../../profiles/types.js";
import { getRequirementsBackend, type ProjectRequirements } from "../requirements.js";

function primaryRuntime(profile: ResolvedTemplateProfile): BackendRuntime | undefined {
  return profile.backend?.runtimes?.[0];
}

function primaryFramework(profile: ResolvedTemplateProfile): BackendFramework | undefined {
  return profile.backend?.frameworks?.[0];
}

function trafficOf(requirements: ProjectRequirements): ApiTrafficExpectation | undefined {
  return requirements.projectType === "server-api" ? requirements.trafficExpectation : undefined;
}

/**
 * Soft default backend ecosystem fit (0–1). Explicit runtime/framework prefs disable this (1).
 *
 * Baseline: Node/TypeScript → 1, Go → 0.35.
 * High / very-high traffic dampens Node-first so Go can surface without a hard constraint.
 */
export function defaultBackendEcosystemFit(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): number {
  if (requirements.projectType !== "server-api") {
    return 1;
  }
  const backend = getRequirementsBackend(requirements);
  if (backend?.runtime || backend?.framework) {
    return 1;
  }
  const runtime = primaryRuntime(profile);
  if (!runtime) {
    return 0.15;
  }

  const traffic = trafficOf(requirements);
  if (traffic === "very-high") {
    // Significant soft preference for Go under performance-critical workloads.
    return runtime === "go" ? 1 : 0.42;
  }
  if (traffic === "high") {
    // Stronger consideration for Go while keeping TypeScript competitive.
    return runtime === "go" ? 1 : 0.72;
  }

  const index = (DEFAULT_BACKEND_ECOSYSTEM_PREFERENCE as readonly string[]).indexOf(runtime);
  if (index === -1) {
    return 0.2;
  }
  return Math.max(0.15, 1 - index * 0.65);
}

/**
 * Soft scalability / traffic fit (0–1) from profile `trafficExpectations`.
 * Returns `undefined` when traffic was not specified (dimension not applicable).
 */
export function backendScalabilityFit(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): number | undefined {
  if (requirements.projectType !== "server-api") {
    return undefined;
  }
  const traffic = trafficOf(requirements);
  if (!traffic) {
    return undefined;
  }

  const levels = profile.trafficExpectations ?? [];
  if (levels.includes(traffic)) {
    return 1;
  }
  if (levels.length === 0) {
    return 0.45;
  }

  const targetIdx = (API_TRAFFIC_EXPECTATIONS as readonly string[]).indexOf(traffic);
  let best = 0.3;
  for (const level of levels) {
    const idx = (API_TRAFFIC_EXPECTATIONS as readonly string[]).indexOf(level);
    if (idx === -1 || targetIdx === -1) continue;
    const dist = Math.abs(idx - targetIdx);
    // Closer declared levels score higher; never hard-zero (Hono stays eligible for very-high).
    best = Math.max(best, Math.max(0.35, 1 - dist * 0.32));
  }
  return best;
}

/**
 * Lower is a better soft fit for a general Backend/API when requirements are comparable.
 * Prefers lightweight Hono over Nest within Node, and Gin over stdlib within Go —
 * without hardcoding a global template ID list in the matcher.
 */
export function backendFrameworkSuitabilityRank(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): number {
  if (requirements.projectType !== "server-api") {
    return 0;
  }
  const backend = getRequirementsBackend(requirements);
  if (backend?.framework) {
    return 0;
  }

  const traffic = trafficOf(requirements);
  // Under high concurrency intent, prefer Gin ahead of stdlib; Nest still after Hono for TS.
  if (traffic === "high" || traffic === "very-high") {
    switch (primaryFramework(profile)) {
      case "gin":
        return 0;
      case "stdlib":
        return 1;
      case "hono":
        return 2;
      case "nest":
        return 3;
      default:
        return 10;
    }
  }

  switch (primaryFramework(profile)) {
    case "hono":
      return 0;
    case "nest":
      return 1;
    case "gin":
      return 2;
    case "stdlib":
      return 3;
    default:
      return 10;
  }
}

/** User-facing template character copy for Backend/API recommendations. */
export function backendTemplateExplanation(profile: ResolvedTemplateProfile): string | undefined {
  switch (primaryFramework(profile)) {
    case "hono":
      return "Lightweight TypeScript API with a simple development workflow. A good fit for standard API workloads.";
    case "nest":
      return "Structured TypeScript backend with clear module boundaries. A good fit for complex business logic and maintainable large applications.";
    case "gin":
      return "Go-based HTTP API suited to concurrent workloads and performance-sensitive services.";
    case "stdlib":
      return "Minimal-dependency Go API with direct control over HTTP handling and server lifecycle.";
    default:
      return undefined;
  }
}

export function backendTrafficExplanation(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): string | undefined {
  const traffic = trafficOf(requirements);
  if (traffic !== "high" && traffic !== "very-high") {
    return undefined;
  }
  if (primaryRuntime(profile) !== "go") {
    return undefined;
  }
  return traffic === "very-high"
    ? "Prioritized for your performance-critical traffic and concurrency expectations."
    : "Considered for your expected high traffic and concurrency.";
}
