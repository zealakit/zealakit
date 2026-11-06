import type { ProjectRequirements } from "../requirements.js";
import { resolveDiscoveryRequirements } from "./resolve.js";
import type { DiscoveryAnswers } from "./types.js";

/**
 * Convert questionnaire answers into engine `ProjectRequirements`.
 * Delegates to the intent → technical requirement resolver.
 */
export function normalizeDiscoveryAnswers(
  answers: DiscoveryAnswers,
): { ok: true; requirements: ProjectRequirements } | { ok: false; errors: string[] } {
  const resolved = resolveDiscoveryRequirements(answers);
  if (!resolved.ok) {
    return resolved;
  }
  return { ok: true, requirements: resolved.requirements };
}
