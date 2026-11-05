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
  /** Extra dim note printed above the prompt (e.g. hybrid ORM caveat) */
  notice?: string;
};

/** Yes/no for a single non-exclusive recipe. */
export type ConfirmStep = {
  kind: "confirm";
  recipeId: string;
  message: string;
  notice?: string;
};

export type PromptStep = SelectStep | ConfirmStep;

const LINTER_STEP: SelectStep = {
  kind: "select",
  category: "linter",
  message: "Select linter / formatter:",
  noneLabel: "No linter",
  initialValue: "biome",
};

const ORM_STEP_SERVER: SelectStep = {
  kind: "select",
  category: "orm",
  message: "Select ORM:",
  noneLabel: "No ORM (in-memory adapters)",
};

const ORM_STEP_HYBRID: SelectStep = {
  kind: "select",
  category: "orm",
  message: "Select ORM (optional, small apps only):",
  noneLabel: "No ORM",
  notice:
    "\nWarning: hybrid templates (Next, Nuxt, Astro hybrid, etc.) are not a pure backend. ORM support is limited — use only for small projects; prefer a dedicated backend framework for production APIs.",
};

const CLIENT_CORE_STEPS: PromptStep[] = [
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
  {
    kind: "select",
    category: "ui",
    message: "Select UI kit:",
    noneLabel: "No UI kit",
  },
  LINTER_STEP,
  {
    kind: "confirm",
    recipeId: "storybook",
    message: "Add Storybook (component docs / UI testing)?",
  },
];

const CLIENT_STEPS: PromptStep[] = CLIENT_CORE_STEPS;

/** Hybrid = client stack + optional ORM (with caveat). ORM sits before linter. */
const HYBRID_STEPS: PromptStep[] = [
  ...CLIENT_CORE_STEPS.slice(0, 4),
  ORM_STEP_HYBRID,
  ...CLIENT_CORE_STEPS.slice(4),
];

const SERVER_STEPS: PromptStep[] = [ORM_STEP_SERVER, LINTER_STEP];

/** Interactive flow per template scope (also exported by `zealakit info`). */
export const STEPS_BY_SCOPE: Record<Scope, PromptStep[]> = {
  client: CLIENT_STEPS,
  hybrid: HYBRID_STEPS,
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
