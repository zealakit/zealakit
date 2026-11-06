import { checkRecipeCompatibility } from "../../../compat.js";
import { resolveRecipeProfile } from "../../../profiles/index.js";
import type { ResolvedTemplateProfile } from "../../../profiles/types.js";
import { getAllRecipeIds, getRecipe, getTemplate } from "../../../registry/index.js";
import {
  getRequirementsBackend,
  getRequirementsFrontend,
  isServiceTypeSupported,
  isTemplateOwnedCapability,
  type ProjectRequirements,
  requiredCapabilities,
  requiresDataIntegration,
} from "../../requirements.js";
import { REASON_CODES, reason } from "../reasons.js";
import type { MatchReason } from "../types.js";

/** True when at least one registry recipe with `database` is compatible with the template. */
export function templateHasCompatibleDatabaseRecipe(templateId: string): boolean {
  const template = getTemplate(templateId);
  if (!template) return false;
  for (const recipeId of getAllRecipeIds()) {
    const profile = resolveRecipeProfile(recipeId);
    const recipe = getRecipe(recipeId);
    if (!profile || !recipe) continue;
    if (!profile.capabilities.includes("database")) continue;
    if (checkRecipeCompatibility(recipe, template)) continue;
    return true;
  }
  return false;
}

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

  if (!profile.projectTypes.includes(requirements.projectType)) {
    failures.push(
      reason(
        REASON_CODES.projectTypeMismatch,
        `Does not support project type '${requirements.projectType}'.`,
      ),
    );
  }

  if (requirements.scopes.length > 0 && !requirements.scopes.includes(profile.scope)) {
    failures.push(
      reason(
        REASON_CODES.scopeMismatch,
        `Scope '${profile.scope}' is outside your preferred scopes (${requirements.scopes.join(", ")}).`,
      ),
    );
  }

  if (
    requirements.projectType === "server-api" &&
    !isServiceTypeSupported(requirements.serviceType)
  ) {
    failures.push(
      reason(
        REASON_CODES.capabilityMissing,
        `Service type '${requirements.serviceType}' is not supported by available templates.`,
      ),
    );
  }

  const needed = requiredCapabilities(requirements);
  for (const capability of needed) {
    if (!isTemplateOwnedCapability(capability)) {
      continue;
    }
    if (!profile.capabilities.includes(capability)) {
      failures.push(
        reason(REASON_CODES.capabilityMissing, `Missing required capability '${capability}'.`),
      );
    }
  }

  // Database / data integration:
  // - Frontend-only UI templates cannot satisfy it (hard fail).
  // - UI hybrids must have a compatible database recipe (hard fail otherwise).
  // - Server/API and Worker starters remain eligible without a shipped DB recipe;
  //   missing recipes are warnings so Go APIs are not dropped solely for lacking Node ORMs.
  if (requiresDataIntegration(requirements)) {
    const canIntegrate =
      profile.capabilities.includes("http-api") || profile.capabilities.includes("database");
    if (!canIntegrate) {
      failures.push(
        reason(
          REASON_CODES.capabilityMissing,
          "Database / data integration requires a template with backend or data capabilities.",
        ),
      );
    } else if (!templateHasCompatibleDatabaseRecipe(profile.id)) {
      if (requirements.projectType === "ui") {
        failures.push(
          reason(
            REASON_CODES.capabilityMissing,
            "No database recipe in the registry is compatible with this template.",
          ),
        );
      } else {
        warnings.push(
          "No database recipe is compatible with this template yet — scaffold the API now and add data access afterward.",
        );
      }
    }
  }

  if (
    (requirements.projectType === "server-api" ||
      requirements.projectType === "background-worker") &&
    requirements.databaseKind === "nosql"
  ) {
    failures.push(
      reason(
        REASON_CODES.capabilityMissing,
        "NoSQL databases are not supported by current templates or recipes.",
      ),
    );
  }

  const backend = getRequirementsBackend(requirements);
  const runtime = backend?.runtime;
  if (runtime) {
    const runtimes = profile.backend?.runtimes ?? [];
    if (!runtimes.includes(runtime)) {
      failures.push(
        reason(REASON_CODES.runtimeMismatch, `Does not support required runtime '${runtime}'.`),
      );
    }
  }

  const backendFramework = backend?.framework;
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

  const frontend = getRequirementsFrontend(requirements);
  const uiFramework = frontend?.framework;
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

  const delivery = frontend?.delivery;
  if (delivery) {
    if (profile.delivery !== delivery) {
      failures.push(
        reason(
          REASON_CODES.frontendFrameworkMismatch,
          `Does not support required delivery stack '${delivery}'.`,
        ),
      );
    }
  }

  const mode = frontend?.mode;
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

  // Soft warnings for recipe-fillable capabilities (not hard failures).
  for (const capability of needed) {
    if (isTemplateOwnedCapability(capability)) continue;
    if (capability === "database") continue; // handled above
    if (!profile.capabilities.includes(capability)) {
      warnings.push(
        `This template does not include '${capability}' by default; a recipe may be required.`,
      );
    }
  }

  return {
    compatible: failures.length === 0,
    failures,
    warnings,
  };
}
