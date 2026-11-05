import {
  type DiscoveryResult,
  getRecipe,
  getTemplate,
  type RecipeMatchResult,
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
      return "recommended";
    case "excluded":
      return "alternative";
    default:
      return "optional";
  }
}

function templateStackHint(templateId: string): string {
  const template = getTemplate(templateId);
  if (!template) {
    return templateId;
  }
  const parts: string[] = [template.scope];
  if (template.uiFramework) {
    parts.push(template.uiFramework);
  }
  if (template.ecosystem === "go") {
    parts.push("go");
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
  projectName: string;
  templateId: string;
  recipeIds: string[];
  autoInjectedIds?: string[];
}): string {
  const template = getTemplate(input.templateId);
  const selected = input.recipeIds.filter((id) => !(input.autoInjectedIds ?? []).includes(id));
  const recipes =
    selected.length > 0 ? selected.map((id) => getRecipe(id)?.name ?? id).join(", ") : "(none)";
  const lines = [
    `Name:      ${input.projectName}`,
    `Template:  ${template?.label ?? input.templateId}`,
    `Recipes:   ${recipes}`,
  ];
  if (input.autoInjectedIds && input.autoInjectedIds.length > 0) {
    lines.push(
      `Auto:      ${input.autoInjectedIds.map((id) => getRecipe(id)?.name ?? id).join(", ")}`,
    );
  }
  return lines.join("\n");
}
