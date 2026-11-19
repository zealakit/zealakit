import type {
  NpmRecipeManifest,
  RecipeCategory,
  RecipeConfig,
  Scope,
  TemplateConfig,
} from "../types.js";

/** Template and recipe catalog. Registration order = prompt option order. */
export class Registry {
  private readonly templateMap = new Map<string, TemplateConfig>();
  private readonly recipeMap = new Map<string, RecipeConfig>();

  registerTemplate(template: TemplateConfig): void {
    this.templateMap.set(template.id, template);
  }

  registerRecipe(recipe: RecipeConfig): void {
    this.recipeMap.set(recipe.id, recipe);
  }

  clear(): void {
    this.templateMap.clear();
    this.recipeMap.clear();
  }

  getTemplate(id: string): TemplateConfig | undefined {
    return this.templateMap.get(id);
  }

  getRecipe(id: string): RecipeConfig | undefined {
    return this.recipeMap.get(id);
  }

  templates(): TemplateConfig[] {
    return [...this.templateMap.values()];
  }

  recipes(): RecipeConfig[] {
    return [...this.recipeMap.values()];
  }
}

/** Process-wide registry that ecosystem packages register into. */
const registry = new Registry();

export function registerTemplate(template: TemplateConfig): void {
  registry.registerTemplate(template);
}

export function registerRecipe(recipe: RecipeConfig): void {
  registry.registerRecipe(recipe);
}

export function clearRegistry(): void {
  registry.clear();
}

export function getTemplate(id: string): TemplateConfig | undefined {
  return registry.getTemplate(id);
}

export function getAllTemplates(): TemplateConfig[] {
  return registry.templates();
}

export function getAllTemplateIds(): string[] {
  return getAllTemplates().map((template) => template.id);
}

export function getRecipe(id: string): RecipeConfig | undefined {
  return registry.getRecipe(id);
}

export function getAllRecipes(): RecipeConfig[] {
  return registry.recipes();
}

export function getAllRecipeIds(): string[] {
  return getAllRecipes().map((recipe) => recipe.id);
}

export function getRecipeCategories(recipe: RecipeConfig): RecipeCategory[] {
  return Array.isArray(recipe.category) ? [...recipe.category] : [recipe.category];
}

export function recipeHasCategory(recipe: RecipeConfig, category: RecipeCategory): boolean {
  return getRecipeCategories(recipe).includes(category);
}

export function getRecipesByCategory(category: RecipeCategory): RecipeConfig[] {
  return getAllRecipes().filter((recipe) => recipeHasCategory(recipe, category));
}

export function recipeSupportsScope(recipe: RecipeConfig, scope: Scope): boolean {
  return recipe.supportedScopes === "all" || recipe.supportedScopes.includes(scope);
}

/** Prepend default recipes for the scope; keeps user order and drops duplicates. */
export function withDefaultRecipes(scope: Scope, recipeIds: string[]): string[] {
  const defaults = getAllRecipes()
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

/** The npm manifest branch of a recipe, or `undefined` for other ecosystems. */
export function getNpmManifest(recipe: RecipeConfig): NpmRecipeManifest | undefined {
  return recipe.manifest.ecosystem === "node" ? recipe.manifest : undefined;
}
