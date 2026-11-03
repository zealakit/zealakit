import { getCompatibleRecipes, isRecipeCompatible } from "./compat.js";
import { getRecipe } from "./registry/index.js";
import type { RecipeCategory, RecipeConfig, Scope, TemplateConfig } from "./types.js";

/** Pick at most one exclusive recipe of `category` (or none). */
export type SelectStep = {
  kind: "select";
  category: RecipeCategory;
  message: string;
  noneLabel: string;
  initialValue?: string;
};

/** Yes/no for a single non-exclusive recipe. */
export type ConfirmStep = { kind: "confirm"; recipeId: string; message: string };

export type PromptStep = SelectStep | ConfirmStep;

const LINTER_STEP: SelectStep = {
  kind: "select",
  category: "linter",
  message: "Select linter / formatter:",
  noneLabel: "No linter",
  initialValue: "biome",
};

const CLIENT_STEPS: PromptStep[] = [
  {
    kind: "select",
    category: "state",
    message: "Select state management:",
    noneLabel: "No state management",
  },
  {
    kind: "select",
    category: "form",
    message: "Select form + validation:",
    noneLabel: "No form library",
  },
  {
    kind: "select",
    category: "fetcher",
    message: "Select HTTP fetcher:",
    noneLabel: "No HTTP client",
  },
  { kind: "select", category: "ui", message: "Select UI kit:", noneLabel: "No UI kit" },
  LINTER_STEP,
  {
    kind: "confirm",
    recipeId: "storybook",
    message: "Add Storybook (component docs / UI testing)?",
  },
];

const SERVER_STEPS: PromptStep[] = [
  {
    kind: "select",
    category: "orm",
    message: "Select ORM:",
    noneLabel: "No ORM (in-memory adapters)",
  },
  LINTER_STEP,
];

/** Interactive flow per template scope (also exported by `zealakit info`). */
export const STEPS_BY_SCOPE: Record<Scope, PromptStep[]> = {
  client: CLIENT_STEPS,
  hybrid: CLIENT_STEPS,
  server: SERVER_STEPS,
  infrastructure: [],
};

/** Recipes the step offers on `template`; an empty list means the step is skipped. */
export function getStepOptions(step: PromptStep, template: TemplateConfig): RecipeConfig[] {
  if (step.kind === "confirm") {
    const recipe = getRecipe(step.recipeId);
    return recipe && isRecipeCompatible(recipe, template) ? [recipe] : [];
  }
  return getCompatibleRecipes(template, step.category).filter((recipe) => recipe.exclusive);
}

/** `initialValue` when it is one of the offered options, otherwise `undefined` (= none). */
export function getStepInitialValue(step: PromptStep, options: RecipeConfig[]): string | undefined {
  return step.kind === "select" && options.some((recipe) => recipe.id === step.initialValue)
    ? step.initialValue
    : undefined;
}
