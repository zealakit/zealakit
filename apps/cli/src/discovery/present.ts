import {
  type BackendFramework,
  type BackendRuntime,
  type DiscoveryResult,
  getRecipe,
  getTemplate,
  type RecipeMatchResult,
  resolveTemplateProfile,
  type TemplateMatchResult,
} from "@zealakit/core";

export type TemplateChoice = {
  value: string;
  label: string;
  hint?: string;
  match: TemplateMatchResult;
};

export type RecipeChoice = {
  value: string;
  label: string;
  hint?: string;
  match: RecipeMatchResult;
};

function primaryReasons(match: TemplateMatchResult | RecipeMatchResult, limit = 2): string[] {
  return match.reasons
    .filter((entry) => !entry.code.includes("mismatch") && entry.code !== "not-relevant")
    .slice(0, limit)
    .map((entry) => entry.message);
}

function recipeRoleLabel(match: RecipeMatchResult): string {
  switch (match.role) {
    case "dependency":
      return "required";
    case "recommended":
      // Non-exclusive recipes are offered, not part of the default selection.
      return getRecipe(match.recipeId)?.exclusive ? "recommended" : "optional";
    case "excluded":
      return "alternative";
    default:
      return "optional";
  }
}

const RUNTIME_LABELS: Record<BackendRuntime, string> = {
  node: "TypeScript",
  go: "Go",
};

const BACKEND_FRAMEWORK_STYLES: Record<BackendFramework, string> = {
  hono: "Lightweight API",
  nest: "Structured backend",
  gin: "Go HTTP framework",
  stdlib: "Minimal dependencies",
};

/** Stack hint derived from Discovery profile metadata (no template-id special cases). */
function templateStackHint(templateId: string): string {
  const template = getTemplate(templateId);
  if (!template) {
    return templateId;
  }
  const profile = resolveTemplateProfile(templateId);
  const runtime = profile?.backend?.runtimes?.[0];
  const framework = profile?.backend?.frameworks?.[0];

  if (profile?.projectTypes.includes("background-worker") && runtime) {
    return `Background processing · ${RUNTIME_LABELS[runtime]}`;
  }
  if (framework && runtime && profile?.projectTypes.includes("server-api")) {
    return `${BACKEND_FRAMEWORK_STYLES[framework]} · ${RUNTIME_LABELS[runtime]}`;
  }

  const parts: string[] = [template.scope];
  if (template.uiFramework) {
    parts.push(template.uiFramework);
  } else if (runtime) {
    parts.push(RUNTIME_LABELS[runtime]);
  }
  return parts.join(" · ");
}

/** Compatible templates only, ranked for the select prompt. */
export function buildTemplateChoices(result: DiscoveryResult): TemplateChoice[] {
  return result.templates
    .filter((entry) => entry.compatible)
    .map((match, index) => {
      const template = getTemplate(match.templateId);
      const badge = index === 0 ? "Best match" : index === 1 ? "Good alternative" : "Alternative";
      const stack = templateStackHint(match.templateId);
      const why = primaryReasons(match)[0];
      const hintParts = [badge, stack];
      if (why) {
        hintParts.push(why);
      }
      return {
        value: match.templateId,
        label: template?.label ?? match.templateId,
        hint: hintParts.join(" · "),
        match,
      };
    });
}

/**
 * Relevant recipes for multiselect.
 * Recommended / required first; exclusivity losers stay available as unchecked alternatives.
 */
export function buildRecipeChoices(result: DiscoveryResult): RecipeChoice[] {
  const choices = result.recipes
    .filter((entry) => entry.compatible && entry.relevant)
    .map((match) => {
      const recipe = getRecipe(match.recipeId);
      const why = primaryReasons(match)[0];
      const roleHint = recipeRoleLabel(match);
      return {
        value: match.recipeId,
        label: recipe?.name ?? match.recipeId,
        hint: why ? `${roleHint} · ${why}` : roleHint,
        match,
      };
    });

  return choices.sort((a, b) => {
    const rank = (role: RecipeMatchResult["role"]): number => {
      switch (role) {
        case "recommended":
          return 0;
        case "dependency":
          return 1;
        case "excluded":
          return 2;
        default:
          return 3;
      }
    };
    const roleDiff = rank(a.match.role) - rank(b.match.role);
    if (roleDiff !== 0) return roleDiff;
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    return a.value.localeCompare(b.value);
  });
}

/** Default selected recipe ids (engine picks + required dependencies). */
export function defaultSelectedRecipeIds(result: DiscoveryResult): string[] {
  const ids = new Set(result.recommendedRecipeIds);
  for (const entry of result.recipes) {
    if (entry.role === "dependency" && entry.compatible) {
      ids.add(entry.recipeId);
    }
  }
  return [...ids];
}

export function formatTemplateDetails(match: TemplateMatchResult): string {
  const template = getTemplate(match.templateId);
  const lines = [
    template?.description ?? match.templateId,
    `Stack: ${templateStackHint(match.templateId)}`,
    ...primaryReasons(match, 2).map((message) => `- ${message}`),
  ];
  if (match.warnings.length > 0) {
    lines.push(`Note: ${match.warnings[0]}`);
  }
  return lines.join("\n");
}

export function formatDiscoverySummary(input: {
  templateId: string;
  recipeIds: string[];
  /** When omitted, naming is asked in a later Discovery stage. */
  projectName?: string;
  autoInjectedIds?: string[];
}): string {
  const template = getTemplate(input.templateId);
  const selected = input.recipeIds.filter((id) => !(input.autoInjectedIds ?? []).includes(id));
  const recipes =
    selected.length > 0 ? selected.map((id) => getRecipe(id)?.name ?? id).join(", ") : "(none)";
  const lines = [`Template:  ${template?.label ?? input.templateId}`, `Recipes:   ${recipes}`];
  if (input.projectName) {
    lines.unshift(`Name:      ${input.projectName}`);
  }
  if (input.autoInjectedIds && input.autoInjectedIds.length > 0) {
    lines.push(
      `Auto:      ${input.autoInjectedIds.map((id) => getRecipe(id)?.name ?? id).join(", ")}`,
    );
  }
  return lines.join("\n");
}
