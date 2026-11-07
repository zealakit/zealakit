import type { Capability, FrontendMode, ProjectPurpose } from "../../../constants.js";
import type { ResolvedTemplateProfile } from "../../../profiles/types.js";
import {
  getRequirementsBackend,
  getRequirementsFrontend,
  type ProjectRequirements,
  requiredCapabilities,
  requiresDataIntegration,
} from "../../requirements.js";
import {
  backendScalabilityFit,
  backendTemplateExplanation,
  backendTrafficExplanation,
  defaultBackendEcosystemFit,
} from "../backend-intent.js";
import { templateHasCompatibleDatabaseRecipe } from "../constraints/template-constraints.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";
import { defaultFrameworkEcosystemFit, interactiveArchitectureFit } from "../ui-intent.js";
import { normalizeScore, TEMPLATE_SCORE_WEIGHTS } from "../weights.js";

function capabilitySatisfied(capability: Capability, profile: ResolvedTemplateProfile): boolean {
  if (profile.capabilities.includes(capability)) {
    return true;
  }
  // Database can be filled by a compatible recipe without living on the template profile.
  return capability === "database" && templateHasCompatibleDatabaseRecipe(profile.id);
}

export type TemplateScoreBreakdown = {
  score: number;
  reasons: MatchReason[];
  warnings: string[];
};

function profileModes(profile: ResolvedTemplateProfile): FrontendMode[] {
  return profile.frontend?.modes ?? profile.frontendModes ?? [];
}

function preferredModeReason(mode: FrontendMode): string {
  switch (mode) {
    case "ssg":
    case "static":
      return "Suitable for content-focused websites and static pages.";
    case "spa":
      return "Well suited for interactive management dashboards and client-side apps.";
    case "ssr":
    case "hybrid":
      return "Supports the requested server rendering behavior.";
    case "islands":
      return "Fits content sites with selective interactivity.";
  }
}

function purposeReason(purpose: ProjectPurpose, requirements: ProjectRequirements): string {
  switch (purpose) {
    case "internal-tool":
      return "Well suited for interactive management dashboards.";
    case "content-platform":
      return "Suitable for content-focused websites and static pages.";
    case "business":
      return requirements.projectType === "server-api"
        ? "A solid fit for business-oriented services and complex domain workflows."
        : "A solid fit for business and marketing websites.";
    case "ecommerce":
      return "Can support storefront-style browsing and product flows.";
    case "saas":
      return "A solid fit for product-style web applications.";
    default:
      return `Aligns with ${purpose.replace(/-/g, " ")} projects.`;
  }
}

/**
 * Score a compatible template. Unanswered preferences do not reduce the score.
 * Soft preferences never exclude — they only rank.
 */
export function scoreTemplate(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): TemplateScoreBreakdown {
  let earned = 0;
  let applicable = 0;
  const reasons: MatchReason[] = [];
  const warnings: string[] = [];

  // Prefer meaningful Backend/API explanations ahead of the generic project-type line.
  if (requirements.projectType === "server-api") {
    const explanation = backendTemplateExplanation(profile);
    if (explanation) {
      reasons.push(reason(REASON_CODES.backendFrameworkMatch, explanation));
    }
    const trafficWhy = backendTrafficExplanation(profile, requirements);
    if (trafficWhy) {
      reasons.push(reason(REASON_CODES.runtimeMatch, trafficWhy));
    }
  }

  applicable += TEMPLATE_SCORE_WEIGHTS.projectType;
  if (profile.projectTypes.includes(requirements.projectType)) {
    earned += TEMPLATE_SCORE_WEIGHTS.projectType;
    if (requirements.projectType !== "server-api") {
      reasons.push(
        reason(
          REASON_CODES.projectTypeMatch,
          "Matches the kind of project you want to create.",
          TEMPLATE_SCORE_WEIGHTS.projectType,
        ),
      );
    }
  }

  const needed = requiredCapabilities(requirements);
  if (needed.length > 0) {
    applicable += TEMPLATE_SCORE_WEIGHTS.capabilities;
    const matched = needed.filter((capability) => capabilitySatisfied(capability, profile));
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
      if (!capabilitySatisfied(capability, profile)) {
        // Database gaps for server/worker are warned in constraint evaluation.
        if (capability === "database") {
          continue;
        }
        warnings.push(`This template does not include '${capability}' by default.`);
      } else if (
        capability === "database" &&
        !profile.capabilities.includes("database") &&
        templateHasCompatibleDatabaseRecipe(profile.id)
      ) {
        reasons.push(
          reason(
            REASON_CODES.capabilityMatch,
            "Database support is available through compatible recipes.",
          ),
        );
      }
    }
  }

  const backend = getRequirementsBackend(requirements);
  const frontend = getRequirementsFrontend(requirements);
  const preferredRuntime = backend?.runtime;
  const preferredBackendFw = backend?.framework;
  const preferredUiFw = frontend?.framework;
  const hardMode = frontend?.mode;
  const preferredDelivery = frontend?.delivery;
  const softPreferredMode = frontend?.preferredMode;
  const needsEmbeddedData = requiresDataIntegration(requirements);

  if (preferredRuntime || preferredBackendFw || preferredUiFw || hardMode || preferredDelivery) {
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
            `Recommended based on your ${preferredUiFw} framework preference.`,
          ),
        );
      }
    }
    if (preferredDelivery) {
      const ok = profile.delivery === preferredDelivery;
      checks.push(ok);
      if (ok) {
        reasons.push(
          reason(
            REASON_CODES.frontendFrameworkMatch,
            `Meets the requested ${preferredDelivery} stack preference.`,
          ),
        );
      }
    }
    if (hardMode) {
      const ok = profileModes(profile).includes(hardMode);
      checks.push(ok);
      if (ok) {
        reasons.push(reason(REASON_CODES.frontendModeMatch, preferredModeReason(hardMode)));
      }
    }
    const ratio = checks.filter(Boolean).length / checks.length;
    earned += TEMPLATE_SCORE_WEIGHTS.runtimeFramework * ratio;
  }

  applicable += TEMPLATE_SCORE_WEIGHTS.scopeFit;
  if (requirements.scopes.length > 0) {
    if (requirements.scopes.includes(profile.scope)) {
      earned += TEMPLATE_SCORE_WEIGHTS.scopeFit;
      reasons.push(
        reason(
          REASON_CODES.scopeMatch,
          `Fits preferred scope '${profile.scope}'.`,
          TEMPLATE_SCORE_WEIGHTS.scopeFit,
        ),
      );
    }
  } else {
    earned += TEMPLATE_SCORE_WEIGHTS.scopeFit;
  }

  // Soft rendering / architecture suitability (never a hard gate).
  if (softPreferredMode && !hardMode) {
    applicable += TEMPLATE_SCORE_WEIGHTS.architectureFit;
    const archFit = interactiveArchitectureFit(profile, softPreferredMode, needsEmbeddedData);
    earned += TEMPLATE_SCORE_WEIGHTS.architectureFit * archFit;
    if (archFit >= 0.85) {
      reasons.push(reason(REASON_CODES.frontendModeMatch, preferredModeReason(softPreferredMode)));
    } else if (profile.delivery === "next" && softPreferredMode === "spa") {
      reasons.push(
        reason(
          REASON_CODES.frontendModeMatch,
          "A strong React web application starter when you may want richer routing later.",
        ),
      );
    } else if (profile.delivery === "astro" && softPreferredMode === "spa") {
      reasons.push(
        reason(
          REASON_CODES.purposeMatch,
          "React on Astro — better for content sites than typical interactive dashboards.",
        ),
      );
    }
  }

  // Soft purpose alignment.
  if (requirements.purpose && profile.purposes?.length) {
    applicable += TEMPLATE_SCORE_WEIGHTS.purposeFit;
    const purposeMatched = profile.purposes.includes(requirements.purpose);
    earned += TEMPLATE_SCORE_WEIGHTS.purposeFit * (purposeMatched ? 1 : 0.35);
    if (purposeMatched) {
      reasons.push(
        reason(REASON_CODES.purposeMatch, purposeReason(requirements.purpose, requirements)),
      );
    }
  }

  // Default ecosystem preference. Explicit prefs skip this.
  // UI: React → Vue → Svelte. Backend/API: Node/TypeScript → Go.
  if (requirements.projectType === "ui" && !preferredUiFw && !preferredDelivery) {
    applicable += TEMPLATE_SCORE_WEIGHTS.frameworkEcosystem;
    const ecosystemFit = defaultFrameworkEcosystemFit(profile, requirements);
    earned += TEMPLATE_SCORE_WEIGHTS.frameworkEcosystem * ecosystemFit;
    if (ecosystemFit >= 0.99 && profile.delivery === "vite") {
      reasons.push(
        reason(
          REASON_CODES.frontendFrameworkMatch,
          "A lightweight client-side React starter suitable for API-driven interfaces.",
        ),
      );
    } else if (ecosystemFit >= 0.99 && profile.delivery === "next") {
      reasons.push(
        reason(
          REASON_CODES.frontendFrameworkMatch,
          "Recommended from the React ecosystem when no framework preference was set.",
        ),
      );
    }
  } else if (
    requirements.projectType === "server-api" &&
    !preferredRuntime &&
    !preferredBackendFw
  ) {
    applicable += TEMPLATE_SCORE_WEIGHTS.frameworkEcosystem;
    const ecosystemFit = defaultBackendEcosystemFit(profile, requirements);
    earned += TEMPLATE_SCORE_WEIGHTS.frameworkEcosystem * ecosystemFit;
  }

  // Soft Backend/API scalability / traffic fit (ranking only).
  if (requirements.projectType === "server-api") {
    const scaleFit = backendScalabilityFit(profile, requirements);
    if (scaleFit !== undefined) {
      applicable += TEMPLATE_SCORE_WEIGHTS.scalabilityFit;
      earned += TEMPLATE_SCORE_WEIGHTS.scalabilityFit * scaleFit;
    }
  }

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

  return {
    score: normalizeScore(earned, applicable),
    reasons,
    warnings,
  };
}
