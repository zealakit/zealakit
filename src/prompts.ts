import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import pc from "picocolors";
import { getCompatibleRecipes, isRecipeCompatible } from "./compat.js";
import {
  DEFAULT_TEMPLATE_ID,
  getAllTemplateIds,
  getRecipe,
  getTemplate,
  withDefaultRecipes,
} from "./registry/index.js";
import type { RecipeCategory, ScaffoldConfig, Scope, TemplateConfig } from "./types.js";
import { isValidNpmPackageName } from "./validation/index.js";

type SelectStep = {
  kind: "select";
  category: RecipeCategory;
  message: string;
  noneLabel: string;
  initialValue?: string;
};

type ConfirmStep = { kind: "confirm"; recipeId: string; message: string };

type PromptStep = SelectStep | ConfirmStep;

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

const STEPS_BY_SCOPE: Record<Scope, PromptStep[]> = {
  client: CLIENT_STEPS,
  hybrid: CLIENT_STEPS,
  server: SERVER_STEPS,
  infrastructure: [],
};

const NONE = "none";

/** Resolves to `null` (after printing "Cancelled.") when the user aborts. */
async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol> | null> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel("Cancelled.");
    return null;
  }
  return value as Exclude<T, symbol>;
}

/** Returns the chosen recipe id, `undefined` for none / skipped, or `null` on cancel. */
async function runStep(
  step: PromptStep,
  template: TemplateConfig,
): Promise<string | undefined | null> {
  if (step.kind === "confirm") {
    const recipe = getRecipe(step.recipeId);
    if (!recipe || !isRecipeCompatible(recipe, template)) {
      return undefined;
    }
    const accepted = await ask(confirm({ message: step.message, initialValue: false }));
    return accepted === null ? null : accepted ? recipe.id : undefined;
  }

  const options = getCompatibleRecipes(template, step.category).filter((r) => r.exclusive);
  if (options.length === 0) {
    return undefined;
  }

  const initialValue = options.some((r) => r.id === step.initialValue) ? step.initialValue : NONE;
  const choice = await ask(
    select<string>({
      message: step.message,
      options: [
        ...options.map((recipe) => ({ value: recipe.id, label: recipe.name, hint: recipe.hint })),
        { value: NONE, label: step.noneLabel },
      ],
      initialValue,
    }),
  );
  return choice === null ? null : choice === NONE ? undefined : choice;
}

async function promptRecipes(template: TemplateConfig): Promise<string[] | null> {
  const recipeIds: string[] = [];
  for (const step of STEPS_BY_SCOPE[template.scope]) {
    const recipeId = await runStep(step, template);
    if (recipeId === null) {
      return null;
    }
    if (recipeId) {
      recipeIds.push(recipeId);
    }
  }
  return recipeIds;
}

async function promptProjectName(): Promise<string | null> {
  return ask(
    text({
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
    }),
  );
}

async function promptTemplate(): Promise<string | null> {
  return ask(
    select<string>({
      message: "Select a base template:",
      options: getAllTemplateIds().map((id) => ({
        value: id,
        label: getTemplate(id)?.label ?? id,
      })),
      initialValue: DEFAULT_TEMPLATE_ID,
    }),
  );
}

export async function runInteractivePrompts(
  initial: { projectName?: string; templateId?: string } = {},
): Promise<ScaffoldConfig | null> {
  intro(`${pc.bgCyan(pc.black(" zealakit "))} Recipe-based scaffolding`);

  const projectName = initial.projectName ?? (await promptProjectName());
  if (projectName === null) {
    return null;
  }

  const templateId = initial.templateId ?? (await promptTemplate());
  const template = templateId ? getTemplate(templateId) : undefined;
  if (!template) {
    cancel("Cancelled.");
    return null;
  }

  const picked = await promptRecipes(template);
  if (picked === null) {
    return null;
  }

  const recipeIds = withDefaultRecipes(template.scope, picked);
  const summary = [
    `  ${pc.dim("Name:")}      ${projectName}`,
    `  ${pc.dim("Template:")} ${template.id}`,
    `  ${pc.dim("Scope:")}    ${template.scope}`,
    `  ${pc.dim("Recipes:")}  ${recipeIds.length > 0 ? recipeIds.join(", ") : pc.dim("(none)")}`,
  ].join("\n");
  console.log(`\n${pc.bold("Summary:")}\n${summary}\n`);

  const shouldProceed = await ask(confirm({ message: "Start scaffolding?", initialValue: true }));
  if (!shouldProceed) {
    if (shouldProceed === false) {
      cancel("Cancelled.");
    }
    return null;
  }

  outro(pc.green("Creating project..."));
  return { projectName, templateId: template.id, recipeIds };
}
