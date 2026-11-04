import { DEFAULT_TEMPLATE_ID, withDefaultRecipes } from "./registry/index.js";
import type { RecipeConfig, Scope, TemplateConfig } from "./types.js";

/** Compact hint under a template option (scope · framework · default). */
export function templateOptionHint(template: TemplateConfig): string {
  const parts: string[] = [template.scope];
  if (template.framework) {
    parts.push(template.framework);
  }
  if (template.id === DEFAULT_TEMPLATE_ID) {
    parts.push("default");
  }
  return parts.join(" · ");
}

/** Label shown in the template picker. */
export function templateOptionLabel(template: TemplateConfig): string {
  return template.label;
}

/** Compact hint under a recipe option. */
export function recipeOptionHint(recipe: RecipeConfig): string {
  const parts: string[] = [];
  if (recipe.hint) {
    parts.push(recipe.hint);
  }
  if (recipe.dependsOn && recipe.dependsOn.length > 0) {
    parts.push(`needs ${recipe.dependsOn.join(", ")}`);
  }
  return parts.join(" · ");
}

/** Default recipes injected for a scope (same source as the CLI). */
export function defaultRecipeIdsForScope(scope: Scope): string[] {
  return withDefaultRecipes(scope, []);
}

export type SelectionSummaryInput = {
  projectName: string;
  template: TemplateConfig;
  /** Recipes the user explicitly chose */
  selectedIds: string[];
  /** Defaults + transitive dependsOn not in selectedIds */
  autoInjectedIds: string[];
};

/** Human-readable selection summary (no colors — caller may wrap). */
export function formatSelectionSummary(input: SelectionSummaryInput): string {
  const framework = input.template.framework ?? "none";
  return [
    `Name:      ${input.projectName}`,
    `Template:  ${input.template.id} (${input.template.scope}, ${framework})`,
    `Selected:  ${input.selectedIds.length > 0 ? input.selectedIds.join(", ") : "(none)"}`,
    `Auto:      ${input.autoInjectedIds.length > 0 ? input.autoInjectedIds.join(", ") : "(none)"}`,
  ].join("\n");
}
