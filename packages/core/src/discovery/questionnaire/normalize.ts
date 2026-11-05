import type { ProjectRequirements } from "../requirements.js";
import type { DiscoveryAnswers } from "./types.js";
import { NO_PREFERENCE } from "./types.js";

function omitPreference<T extends string>(
  value: T | typeof NO_PREFERENCE | undefined,
): T | undefined {
  if (value === undefined || value === NO_PREFERENCE) {
    return undefined;
  }
  return value;
}

/**
 * Convert questionnaire answers into engine `ProjectRequirements`.
 * Returns errors when required fields are missing.
 */
export function normalizeDiscoveryAnswers(
  answers: DiscoveryAnswers,
): { ok: true; requirements: ProjectRequirements } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!answers.projectType) {
    errors.push("Project type is required.");
  }
  if (errors.length > 0 || !answers.projectType) {
    return { ok: false, errors };
  }

  const frontendFramework = omitPreference(answers.frontendFramework);
  const frontendMode = omitPreference(answers.frontendMode);
  const backendRuntime = omitPreference(answers.backendRuntime);
  const backendFramework = omitPreference(answers.backendFramework);
  const deploymentTarget = omitPreference(answers.deploymentTarget);
  const architectureLevel = omitPreference(answers.architectureLevel);
  const purpose = omitPreference(answers.purpose);

  const requirements: ProjectRequirements = {
    projectType: answers.projectType,
    scopes: answers.scopes ? [...answers.scopes] : [],
    capabilities: answers.capabilities ? [...answers.capabilities] : [],
  };

  if (purpose) {
    requirements.purpose = purpose;
  }
  if (frontendFramework || frontendMode) {
    requirements.frontend = {
      ...(frontendFramework ? { framework: frontendFramework } : {}),
      ...(frontendMode ? { mode: frontendMode } : {}),
    };
  }
  if (backendRuntime || backendFramework) {
    requirements.backend = {
      ...(backendRuntime ? { runtime: backendRuntime } : {}),
      ...(backendFramework ? { framework: backendFramework } : {}),
    };
  }
  if (answers.databases && answers.databases.length > 0) {
    requirements.databases = [...answers.databases];
  }
  if (deploymentTarget) {
    requirements.deploymentTarget = deploymentTarget;
  }
  if (architectureLevel) {
    requirements.architectureLevel = architectureLevel;
  }

  return { ok: true, requirements };
}
