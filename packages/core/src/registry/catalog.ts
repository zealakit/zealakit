import type { RecipeCategory, RecipeConfig, Scope, TemplateConfig } from "../types.js";

/** Mutable catalogs filled by ecosystem registration. */
export const templates: Record<string, TemplateConfig> = {};
export const recipes: Record<string, RecipeConfig> = {};

/** Registration order = prompt option order. */
const recipeOrder: string[] = [];

export function registerTemplate(template: TemplateConfig): void {
  templates[template.id] = template;
}

export function registerRecipe(recipe: RecipeConfig): void {
  if (!(recipe.id in recipes)) {
    recipeOrder.push(recipe.id);
  }
  recipes[recipe.id] = recipe;
}

export function clearRegistry(): void {
  for (const key of Object.keys(templates)) {
    delete templates[key];
  }
  for (const key of Object.keys(recipes)) {
    delete recipes[key];
  }
  recipeOrder.length = 0;
}

export function getTemplate(id: string): TemplateConfig | undefined {
  return templates[id];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}

export function getRecipe(id: string): RecipeConfig | undefined {
  return recipes[id];
}

export function getAllRecipeIds(): string[] {
  return [...recipeOrder];
}

export function getRecipeCategories(recipe: RecipeConfig): RecipeCategory[] {
  return Array.isArray(recipe.category) ? [...recipe.category] : [recipe.category];
}

export function recipeHasCategory(recipe: RecipeConfig, category: RecipeCategory): boolean {
  return getRecipeCategories(recipe).includes(category);
}

export function getRecipesByCategory(category: RecipeCategory): RecipeConfig[] {
  return recipeOrder
    .map((id) => recipes[id])
    .filter((recipe): recipe is RecipeConfig => Boolean(recipe))
    .filter((recipe) => recipeHasCategory(recipe, category));
}

export function recipeSupportsScope(recipe: RecipeConfig, scope: Scope): boolean {
  return recipe.supportedScopes === "all" || recipe.supportedScopes.includes(scope);
}

/** Prepend default recipes for the scope; keeps user order and drops duplicates. */
export function withDefaultRecipes(scope: Scope, recipeIds: string[]): string[] {
  const defaults = recipeOrder
    .map((id) => recipes[id])
    .filter((recipe): recipe is RecipeConfig => Boolean(recipe))
    .filter((recipe) => recipe.default && recipeSupportsScope(recipe, scope))
    .map((recipe) => recipe.id);

  return [...new Set([...defaults, ...recipeIds])];
}

export const DEFAULT_TEMPLATE_ID = "vite-react";

export function getTemplateDevCommand(template: TemplateConfig): string {
  return template.devCommand ?? "npm run dev";
}

/** Overlay folder name for recipe overlays under recipes/<recipe>/overlays. */
export function getTemplateOverlayId(templateId: string): string {
  const template = getTemplate(templateId);
  return template?.overlay ?? templateId;
}
