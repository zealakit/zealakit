import type { FrontendDelivery, FrontendMode } from "../../constants.js";
import { DEFAULT_UI_FRAMEWORK_PREFERENCE } from "../../constants.js";
import type { ResolvedTemplateProfile } from "../../profiles/types.js";
import {
  getRequirementsFrontend,
  type ProjectRequirements,
  requiresDataIntegration,
} from "../requirements.js";
import { backendFrameworkSuitabilityRank } from "./backend-intent.js";

function profileModes(profile: ResolvedTemplateProfile): FrontendMode[] {
  return profile.frontend?.modes ?? profile.frontendModes ?? [];
}

function deliveryOf(profile: ResolvedTemplateProfile): FrontendDelivery | undefined {
  return profile.delivery;
}

/**
 * Soft fit for an inferred rendering preference (0–1).
 * Next/Nuxt count as interactive app frameworks for `spa` intent without requiring SPA mode.
 */
export function interactiveArchitectureFit(
  profile: ResolvedTemplateProfile,
  preferredMode: FrontendMode | undefined,
  needsEmbeddedData: boolean,
): number {
  if (!preferredMode) {
    return 1;
  }
  const modes = profileModes(profile);
  const delivery = deliveryOf(profile);

  if (needsEmbeddedData) {
    if (profile.capabilities.includes("http-api") || profile.capabilities.includes("database")) {
      return modes.includes(preferredMode) || delivery === "next" || delivery === "nuxt" ? 1 : 0.7;
    }
    return 0.2;
  }

  if (preferredMode === "spa") {
    if (delivery === "vite" && modes.includes("spa")) {
      return 1;
    }
    if (delivery === "next") {
      // Strong React app candidate — not penalized for also supporting servers.
      return 0.92;
    }
    if (delivery === "nuxt") {
      return 0.92;
    }
    if (delivery === "astro" && profile.scope === "client") {
      // Eligible React option, not an interchangeable Vite SPA replacement.
      return 0.55;
    }
    if (delivery === "astro") {
      // Hybrid Astro for SPA dashboards is usually unnecessary complexity.
      return 0.15;
    }
    if (modes.includes("spa")) {
      return 0.9;
    }
    return 0.25;
  }

  if (preferredMode === "ssg" || preferredMode === "static") {
    if (modes.includes("ssg") || modes.includes("static") || modes.includes("islands")) {
      if (delivery === "astro" && profile.scope === "client") {
        return 1;
      }
      if (delivery === "next" || delivery === "nuxt") {
        return 0.88;
      }
      return 0.8;
    }
    if (delivery === "vite") {
      return 0.55;
    }
    return 0.3;
  }

  if (preferredMode === "ssr" || preferredMode === "hybrid") {
    if (modes.includes(preferredMode) || modes.includes("ssr") || modes.includes("hybrid")) {
      return 1;
    }
    return 0.2;
  }

  return modes.includes(preferredMode) ? 1 : 0.25;
}

/** Soft default framework ecosystem fit (0–1). Explicit prefs disable this (returns 1). */
export function defaultFrameworkEcosystemFit(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): number {
  if (requirements.projectType !== "ui") {
    return 1;
  }
  const frontend = getRequirementsFrontend(requirements);
  if (frontend?.framework || frontend?.delivery) {
    return 1;
  }
  if (!profile.uiFramework) {
    return 0.15;
  }
  const index = (DEFAULT_UI_FRAMEWORK_PREFERENCE as readonly string[]).indexOf(profile.uiFramework);
  if (index === -1) {
    return 0.2;
  }
  // Deterministic ecosystem ladder: react → 1, vue → 0.35, svelte → 0.15.
  // Not market-share math — a controlled soft ranking factor only.
  return Math.max(0.15, 1 - index * 0.65);
}

/**
 * Lower is a better architecture match for the resolved intent (tie-break only).
 * UI: keeps Vite ahead of Next for standalone client dashboards without burying Next.
 * Server/API: prefers lightweight Hono / Gin over heavier or more minimal siblings.
 */
export function templateArchitectureSuitabilityRank(
  profile: ResolvedTemplateProfile,
  requirements: ProjectRequirements,
): number {
  if (requirements.projectType === "server-api") {
    return backendFrameworkSuitabilityRank(profile, requirements);
  }
  if (requirements.projectType !== "ui") {
    return 0;
  }
  const frontend = getRequirementsFrontend(requirements);
  const preferredMode = frontend?.preferredMode;
  const needsEmbeddedData = requiresDataIntegration(requirements);
  const delivery = deliveryOf(profile);

  if (preferredMode === "spa" && !needsEmbeddedData) {
    if (delivery === "vite" && profileModes(profile).includes("spa")) {
      return 0;
    }
    if (delivery === "next") {
      return 1;
    }
    if (delivery === "astro" && profile.scope === "client") {
      return 2;
    }
    if (delivery === "nuxt") {
      return 3;
    }
    if (delivery === "astro") {
      return 4;
    }
    return 5;
  }

  if ((preferredMode === "ssg" || preferredMode === "static") && !needsEmbeddedData) {
    if (delivery === "astro" && profile.scope === "client") {
      return 0;
    }
    if (delivery === "next" || delivery === "nuxt") {
      return 1;
    }
    if (delivery === "vite") {
      return 2;
    }
    if (delivery === "astro") {
      return 3;
    }
    return 4;
  }

  return templateArchitectureSuitabilityRankFallback(profile);
}

function templateArchitectureSuitabilityRankFallback(profile: ResolvedTemplateProfile): number {
  if (profile.scope === "client") {
    return 0;
  }
  if (profile.scope === "hybrid") {
    return 1;
  }
  return 2;
}
