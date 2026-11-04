import type { RecipeCategory, RecipeConfig, Scope } from "../../types.js";
import antd from "./antd.js";
import axios from "./axios.js";
import biome from "./biome.js";
import clientSharedPieces from "./client-shared-pieces.js";
import drizzleOrm from "./drizzle-orm.js";
import eslint from "./eslint.js";
import hookformZod from "./hookform-zod.js";
import kyjs from "./kyjs.js";
import mikroOrm from "./mikro-orm.js";
import mui from "./mui.js";
import nanostores from "./nanostores.js";
import nuxtUi from "./nuxt-ui.js";
import pinia from "./pinia.js";
import prisma from "./prisma.js";
import shadcnUi from "./shadcn-ui.js";
import shadcnVue from "./shadcn-vue.js";
import storybook from "./storybook.js";
import typeOrm from "./type-orm.js";
import veeValidateZod from "./vee-validate-zod.js";
import zustand from "./zustand.js";

/** Registration order = prompt option order. One module per recipe: `./<id>.ts`. */
const RECIPE_LIST: RecipeConfig[] = [
  biome,
  eslint,
  zustand,
  pinia,
  nanostores,
  clientSharedPieces,
  hookformZod,
  veeValidateZod,
  kyjs,
  axios,
  antd,
  mui,
  shadcnUi,
  nuxtUi,
  shadcnVue,
  storybook,
  typeOrm,
  mikroOrm,
  drizzleOrm,
  prisma,
];

export const recipes: Record<string, RecipeConfig> = Object.fromEntries(
  RECIPE_LIST.map((recipe) => [recipe.id, recipe]),
);

export function getRecipe(id: string): RecipeConfig | undefined {
  return recipes[id];
}

export function getAllRecipeIds(): string[] {
  return Object.keys(recipes);
}

export function getRecipeCategories(recipe: RecipeConfig): RecipeCategory[] {
  return Array.isArray(recipe.category) ? [...recipe.category] : [recipe.category];
}

export function recipeHasCategory(recipe: RecipeConfig, category: RecipeCategory): boolean {
  return getRecipeCategories(recipe).includes(category);
}

export function getRecipesByCategory(category: RecipeCategory): RecipeConfig[] {
  return RECIPE_LIST.filter((recipe) => recipeHasCategory(recipe, category));
}

export function recipeSupportsScope(recipe: RecipeConfig, scope: Scope): boolean {
  return recipe.supportedScopes === "all" || recipe.supportedScopes.includes(scope);
}

/** Prepend default recipes for the scope; keeps user order and drops duplicates. */
export function withDefaultRecipes(scope: Scope, recipeIds: string[]): string[] {
  const defaults = RECIPE_LIST.filter(
    (recipe) => recipe.default && recipeSupportsScope(recipe, scope),
  ).map((recipe) => recipe.id);

  return [...new Set([...defaults, ...recipeIds])];
}
