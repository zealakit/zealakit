import type { ResolvedTemplateProfile } from "../../../profiles/types.js";
import { type ProjectRequirements, requiredCapabilities } from "../../requirements.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";
import { normalizeScore, TEMPLATE_SCORE_WEIGHTS } from "../weights.js";

export type TemplateScoreBreakdown = {
  score: number;
  reasons: MatchReason[];
  warnings: string[];
};

/**
 * Score a compatible template. Unanswered preferences do not reduce the score.
 */
export function scoreTemplate(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): TemplateScoreBreakdown {
  let earned = 0;
  let applicable = 0;
  const reasons: MatchReason[] = [];
  const warnings: string[] = [];

  // Project type
  if (requirements.projectType !== "unknown") {
    applicable += TEMPLATE_SCORE_WEIGHTS.projectType;
    if (profile.projectTypes.includes(requirements.projectType)) {
      earned += TEMPLATE_SCORE_WEIGHTS.projectType;
      reasons.push(
        reason(
          REASON_CODES.projectTypeMatch,
          "Matches your selected project type.",
          TEMPLATE_SCORE_WEIGHTS.projectType,
        ),
      );
    }
  }

  // Capabilities (only score capabilities the user needs)
  const needed = requiredCapabilities(requirements);
  if (needed.length > 0) {
    applicable += TEMPLATE_SCORE_WEIGHTS.capabilities;
    const matched = needed.filter((capability) => profile.capabilities.includes(capability));
    const ratio = matched.length / needed.length;
    const points = TEMPLATE_SCORE_WEIGHTS.capabilities * ratio;
    earned += points;
    if (matched.length > 0) {
      reasons.push(
        reason(
          REASON_CODES.capabilityMatch,
          `Provides ${matched.join(", ")}.`,
          Math.round(points * 100) / 100,
        ),
      );
    }
    for (const capability of needed) {
      if (!profile.capabilities.includes(capability)) {
        warnings.push(`This template does not include '${capability}' by default.`);
      }
    }
  }

  // Runtime / framework preferences
  const preferredRuntime = requirements.backend?.runtime;
  const preferredBackendFw = requirements.backend?.framework;
  const preferredUiFw = requirements.frontend?.framework;
  const preferredMode = requirements.frontend?.mode;
  if (preferredRuntime || preferredBackendFw || preferredUiFw || preferredMode) {
    applicable += TEMPLATE_SCORE_WEIGHTS.runtimeFramework;
    const checks: boolean[] = [];
    if (preferredRuntime) {
      const ok = profile.backend?.runtimes?.includes(preferredRuntime) ?? false;
      checks.push(ok);
      if (ok) {
        reasons.push(
          reason(REASON_CODES.runtimeMatch, `Supports your preferred ${preferredRuntime} runtime.`),
        );
      }
    }
    if (preferredBackendFw) {
      const ok = profile.backend?.frameworks?.includes(preferredBackendFw) ?? false;
      checks.push(ok);
      if (ok) {
        reasons.push(
          reason(
            REASON_CODES.backendFrameworkMatch,
            `Supports your preferred ${preferredBackendFw} backend framework.`,
          ),
        );
      }
    }
    if (preferredUiFw) {
      const ok = profile.uiFramework === preferredUiFw;
      checks.push(ok);
      if (ok) {
        reasons.push(
          reason(
            REASON_CODES.frontendFrameworkMatch,
            `Supports the required ${preferredUiFw} frontend.`,
          ),
        );
      }
    }
    if (preferredMode) {
      const modes = profile.frontend?.modes ?? profile.frontendModes ?? [];
      const ok = modes.includes(preferredMode);
      checks.push(ok);
      if (ok) {
        reasons.push(
          reason(REASON_CODES.frontendModeMatch, `Supports frontend mode '${preferredMode}'.`),
        );
      }
    }
    const ratio = checks.filter(Boolean).length / checks.length;
    earned += TEMPLATE_SCORE_WEIGHTS.runtimeFramework * ratio;
  }

  // Scope / frontend-backend fit
  applicable += TEMPLATE_SCORE_WEIGHTS.scopeFit;
  let scopePoints = 0;
  if (requirements.scopes.length > 0) {
    if (requirements.scopes.includes(profile.scope)) {
      scopePoints = TEMPLATE_SCORE_WEIGHTS.scopeFit;
      reasons.push(
        reason(
          REASON_CODES.scopeMatch,
          `Fits preferred scope '${profile.scope}'.`,
          TEMPLATE_SCORE_WEIGHTS.scopeFit,
        ),
      );
    }
  } else {
    // No preference: full credit for having a coherent scope relative to project type needs
    scopePoints = TEMPLATE_SCORE_WEIGHTS.scopeFit;
    reasons.push(
      reason(
        REASON_CODES.scopeMatch,
        `Uses scope '${profile.scope}'.`,
        TEMPLATE_SCORE_WEIGHTS.scopeFit,
      ),
    );
  }
  earned += scopePoints;

  // Architecture preference
  if (requirements.architectureLevel) {
    applicable += TEMPLATE_SCORE_WEIGHTS.architecture;
    if (profile.architectureLevels?.includes(requirements.architectureLevel)) {
      earned += TEMPLATE_SCORE_WEIGHTS.architecture;
      reasons.push(
        reason(
          REASON_CODES.architectureMatch,
          "Uses an architecture level suitable for your requirements.",
          TEMPLATE_SCORE_WEIGHTS.architecture,
        ),
      );
    } else {
      warnings.push(
        `Preferred architecture '${requirements.architectureLevel}' is not explicitly listed for this template.`,
      );
    }
  }

  // Deployment preference
  if (requirements.deploymentTarget) {
    applicable += TEMPLATE_SCORE_WEIGHTS.deployment;
    if (profile.deploymentTargets?.includes(requirements.deploymentTarget)) {
      earned += TEMPLATE_SCORE_WEIGHTS.deployment;
      reasons.push(
        reason(
          REASON_CODES.deploymentMatch,
          `Supports deployment target '${requirements.deploymentTarget}'.`,
          TEMPLATE_SCORE_WEIGHTS.deployment,
        ),
      );
    } else {
      warnings.push(
        `Preferred deployment '${requirements.deploymentTarget}' is not explicitly listed for this template.`,
      );
    }
  }

  if (requirements.purpose && profile.purposes?.includes(requirements.purpose)) {
    reasons.push(
      reason(REASON_CODES.purposeMatch, `Aligns with purpose '${requirements.purpose}'.`),
    );
  }

  return {
    score: normalizeScore(earned, applicable),
    reasons,
    warnings,
  };
}
