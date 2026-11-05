import type { ResolvedTemplateProfile } from "../../../profiles/types.js";
import {
  isTemplateOwnedCapability,
  type ProjectRequirements,
  requiredCapabilities,
} from "../../requirements.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";

export type TemplateConstraintResult = {
  compatible: boolean;
  failures: MatchReason[];
  warnings: string[];
};

/**
 * Hard eligibility for a template against requirements.
 * Unanswered preferences are ignored.
 */
export function evaluateTemplateConstraints(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): TemplateConstraintResult {
  const failures: MatchReason[] = [];
  const warnings: string[] = [];

  if (requirements.projectType !== "unknown") {
    if (!profile.projectTypes.includes(requirements.projectType)) {
      failures.push(
        reason(
          REASON_CODES.projectTypeMismatch,
          `Does not support project type '${requirements.projectType}'.`,
        ),
      );
    }
  }

  if (requirements.scopes.length > 0 && !requirements.scopes.includes(profile.scope)) {
    failures.push(
      reason(
        REASON_CODES.scopeMismatch,
        `Scope '${profile.scope}' is outside your preferred scopes (${requirements.scopes.join(", ")}).`,
      ),
    );
  }

  const needed = requiredCapabilities(requirements);
  for (const capability of needed) {
    if (!isTemplateOwnedCapability(capability)) {
      if (!profile.capabilities.includes(capability)) {
        warnings.push(
          `This template does not include '${capability}' by default; a recipe may be required.`,
        );
      }
      continue;
    }
    if (!profile.capabilities.includes(capability)) {
      failures.push(
        reason(REASON_CODES.capabilityMissing, `Missing required capability '${capability}'.`),
      );
    }
  }

  const runtime = requirements.backend?.runtime;
  if (runtime) {
    const runtimes = profile.backend?.runtimes ?? [];
    if (!runtimes.includes(runtime)) {
      failures.push(
        reason(REASON_CODES.runtimeMismatch, `Does not support required runtime '${runtime}'.`),
      );
    }
  }

  const backendFramework = requirements.backend?.framework;
  if (backendFramework) {
    const frameworks = profile.backend?.frameworks ?? [];
    if (!frameworks.includes(backendFramework)) {
      failures.push(
        reason(
          REASON_CODES.backendFrameworkMismatch,
          `Does not support required backend framework '${backendFramework}'.`,
        ),
      );
    }
  }

  const uiFramework = requirements.frontend?.framework;
  if (uiFramework) {
    if (profile.uiFramework !== uiFramework) {
      failures.push(
        reason(
          REASON_CODES.frontendFrameworkMismatch,
          `Does not support required UI framework '${uiFramework}'.`,
        ),
      );
    }
  }

  const mode = requirements.frontend?.mode;
  if (mode) {
    const modes = profile.frontend?.modes ?? profile.frontendModes ?? [];
    if (!modes.includes(mode)) {
      failures.push(
        reason(
          REASON_CODES.frontendModeMismatch,
          `Does not support required frontend mode '${mode}'.`,
        ),
      );
    }
  }

  return {
    compatible: failures.length === 0,
    failures,
    warnings,
  };
}
