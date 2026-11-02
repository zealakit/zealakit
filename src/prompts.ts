import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import pc from "picocolors";
import {
  getAllTemplateIds,
  getExclusiveUiRecipes,
  getRecipesByCategory,
  getTemplate,
  getTemplateOverlayId,
  withDefaultRecipes,
} from "./registry/index.js";
import type { RecipeConfig, ScaffoldConfig, Scope, UiFrameworkCategory } from "./types.js";
import { isValidNpmPackageName } from "./validator.js";

/** Map template overlay family → UI framework tag (extend when Vue/Svelte templates land). */
function getUiFrameworkCategory(templateId: string): UiFrameworkCategory | undefined {
  const overlay = getTemplateOverlayId(templateId);

  if (overlay === "vite-react" || overlay === "next") {
    return "ui-react";
  }

  if (overlay === "vite-vue" || overlay === "nuxt") {
    return "ui-vue";
  }

  if (overlay === "vite-svelte" || overlay === "sveltekit") {
    return "ui-svelte";
  }

  return undefined;
}

type LinterChoice = "biome" | "eslint" | "none";

const STATE_RECIPE_HINTS: Partial<Record<string, string>> = {
  zustand: "Recommended",
};

function getStateRecipeLabel(recipe: RecipeConfig): string {
  if (recipe.id === "zustand") {
    return "Zustand";
  }

  return recipe.name;
}

function mapLinterToRecipe(linter: LinterChoice): string | null {
  if (linter === "biome" || linter === "eslint") {
    return linter;
  }

  return null;
}

async function promptClientRecipes(templateId: string): Promise<string[] | null> {
  const recipeIds: string[] = [];
  const stateRecipes = getRecipesByCategory("state");
  const formRecipes = getRecipesByCategory("form");
  const fetcherRecipes = getRecipesByCategory("fetcher");
  // Exclusive UI kits for this template's framework (+ shared `ui`-only kits).
  // Storybook (multi-category, non-exclusive) is prompted separately.
  const uiFamily = getUiFrameworkCategory(templateId);
  const uiRecipes = uiFamily
    ? getExclusiveUiRecipes(uiFamily)
    : getRecipesByCategory("ui").filter((recipe) => recipe.exclusive);

  const stateChoice = await select<string>({
    message: "Select state management:",
    options: [
      ...stateRecipes.map((recipe) => ({
        value: recipe.id,
        label: getStateRecipeLabel(recipe),
        hint: STATE_RECIPE_HINTS[recipe.id],
      })),
      { value: "none", label: "No state management" },
    ],
    initialValue: "none",
  });

  if (isCancel(stateChoice)) {
    cancel("Cancelled.");
    return null;
  }

  const formChoice = await select<string>({
    message: "Select form + validation:",
    options: [
      ...formRecipes.map((recipe) => ({
        value: recipe.id,
        label: recipe.name,
        hint: recipe.id === "hookform-zod" ? "Recommended" : undefined,
      })),
      { value: "none", label: "No form library" },
    ],
    initialValue: "none",
  });

  if (isCancel(formChoice)) {
    cancel("Cancelled.");
    return null;
  }

  const fetcherChoice = await select<string>({
    message: "Select HTTP fetcher:",
    options: [
      ...fetcherRecipes.map((recipe) => ({
        value: recipe.id,
        label: recipe.name,
        hint: recipe.id === "kyjs" ? "Lightweight fetch wrapper" : undefined,
      })),
      { value: "none", label: "No HTTP client" },
    ],
    initialValue: "none",
  });

  if (isCancel(fetcherChoice)) {
    cancel("Cancelled.");
    return null;
  }

  const uiChoice = await select<string>({
    message: "Select UI kit:",
    options: [
      ...uiRecipes.map((recipe) => ({
        value: recipe.id,
        label: recipe.name,
      })),
      { value: "none", label: "No UI kit" },
    ],
    initialValue: "none",
  });

  if (isCancel(uiChoice)) {
    cancel("Cancelled.");
    return null;
  }

  const linterChoice = await select<LinterChoice>({
    message: "Select linter / formatter:",
    options: [
      {
        value: "biome",
        label: "Biome — Fast, all-in-one",
        hint: "Recommended",
      },
      { value: "eslint", label: "ESLint — Flat Config" },
      { value: "none", label: "No linter" },
    ],
    initialValue: "biome",
  });

  if (isCancel(linterChoice)) {
    cancel("Cancelled.");
    return null;
  }

  if (stateChoice !== "none") {
    recipeIds.push(stateChoice);
  }

  if (formChoice !== "none") {
    recipeIds.push(formChoice);
  }

  if (fetcherChoice !== "none") {
    recipeIds.push(fetcherChoice);
  }

  if (uiChoice !== "none") {
    recipeIds.push(uiChoice);
  }

  const linterRecipe = mapLinterToRecipe(linterChoice);
  if (linterRecipe) {
    recipeIds.push(linterRecipe);
  }

  const addStorybook = await confirm({
    message: "Add Storybook (component docs / UI testing)?",
    initialValue: false,
  });

  if (isCancel(addStorybook)) {
    cancel("Cancelled.");
    return null;
  }

  if (addStorybook) {
    recipeIds.push("storybook");
  }

  return recipeIds;
}

async function promptServerRecipes(): Promise<string[] | null> {
  const recipeIds: string[] = [];
  const ormRecipes = getRecipesByCategory("orm");

  const ormChoice = await select<string>({
    message: "Select ORM:",
    options: [
      ...ormRecipes.map((recipe) => ({
        value: recipe.id,
        label: recipe.name,
        hint: recipe.id === "drizzle-orm" ? "Lightweight SQL" : undefined,
      })),
      { value: "none", label: "No ORM (in-memory adapters)" },
    ],
    initialValue: "none",
  });

  if (isCancel(ormChoice)) {
    cancel("Cancelled.");
    return null;
  }

  const linterChoice = await select<LinterChoice>({
    message: "Select linter / formatter:",
    options: [
      {
        value: "biome",
        label: "Biome — Fast, all-in-one",
        hint: "Recommended",
      },
      { value: "eslint", label: "ESLint — Flat Config" },
      { value: "none", label: "No linter" },
    ],
    initialValue: "biome",
  });

  if (isCancel(linterChoice)) {
    cancel("Cancelled.");
    return null;
  }

  if (ormChoice !== "none") {
    recipeIds.push(ormChoice);
  }

  const linterRecipe = mapLinterToRecipe(linterChoice);
  if (linterRecipe) {
    recipeIds.push(linterRecipe);
  }

  return recipeIds;
}

async function promptRecipesForScope(scope: Scope, templateId: string): Promise<string[] | null> {
  if (scope === "client" || scope === "hybrid") {
    return promptClientRecipes(templateId);
  }

  if (scope === "server") {
    return promptServerRecipes();
  }

  return [];
}

export async function runInteractivePrompts(
  initialProjectName?: string,
): Promise<ScaffoldConfig | null> {
  intro(`${pc.bgCyan(pc.black(" zealakit "))} Recipe-based scaffolding`);

  let projectName = initialProjectName;

  if (!projectName) {
    const nameInput = await text({
      message: "What is your project name?",
      placeholder: "my-app",
      validate: (value) => {
        const name = value?.trim() ?? "";
        if (!name) {
          return "Project name cannot be empty.";
        }

        if (!isValidNpmPackageName(name)) {
          return "Invalid name. Use lowercase letters, no spaces (npm naming rules).";
        }
      },
    });

    if (isCancel(nameInput)) {
      cancel("Cancelled.");
      return null;
    }

    projectName = nameInput;
  }

  const templateLabels: Record<string, string> = {
    "vite-react": "Vite + React + TypeScript",
    next: "Next.js App Router + TypeScript",
    nest: "NestJS + TypeScript (DDD / hexagonal)",
    hono: "Hono + TypeScript (DDD / hexagonal)",
  };

  const templateId = await select({
    message: "Select a base template:",
    options: getAllTemplateIds().map((id) => ({
      value: id,
      label: templateLabels[id] ?? id,
      hint: id === "vite-react" ? "Recommended" : undefined,
    })),
    initialValue: "vite-react",
  });

  if (isCancel(templateId)) {
    cancel("Cancelled.");
    return null;
  }

  const template = getTemplate(templateId);
  if (!template) {
    cancel("Cancelled.");
    return null;
  }

  const recipeIds = await promptRecipesForScope(template.scope, templateId);
  if (recipeIds === null) {
    return null;
  }

  const resolvedRecipeIds = withDefaultRecipes(template.scope, recipeIds);

  const summary = [
    `  ${pc.dim("Name:")}      ${projectName}`,
    `  ${pc.dim("Template:")} ${templateId}`,
    `  ${pc.dim("Scope:")}    ${template.scope}`,
    `  ${pc.dim("Recipes:")}  ${resolvedRecipeIds.length > 0 ? resolvedRecipeIds.join(", ") : pc.dim("(none)")}`,
  ].join("\n");

  console.log(`\n${pc.bold("Summary:")}\n${summary}\n`);

  const shouldProceed = await confirm({
    message: "Start scaffolding?",
    initialValue: true,
  });

  if (isCancel(shouldProceed) || !shouldProceed) {
    cancel("Cancelled.");
    return null;
  }

  outro(pc.green("Creating project..."));

  return {
    projectName,
    templateId,
    recipeIds: resolvedRecipeIds,
  };
}
