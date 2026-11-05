import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import {
  DEFAULT_TEMPLATE_ID,
  getAllTemplateIds,
  getTemplate,
  resolveRecipeDependencies,
  type ScaffoldConfig,
  type TemplateConfig,
  withDefaultRecipes,
} from "@zealakit/core";
import { isValidNpmPackageName } from "@zealakit/ecosystem-node";
import pc from "picocolors";
import {
  defaultRecipeIdsForScope,
  formatSelectionSummary,
  recipeOptionHint,
  templateOptionHint,
  templateOptionLabel,
} from "./prompt-labels.js";
import {
  getStepInitialValue,
  getStepOptions,
  type PromptStep,
  STEPS_BY_SCOPE,
} from "./prompt-steps.js";

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
  const options = getStepOptions(step, template);
  const [first] = options;
  if (!first) {
    return undefined;
  }

  if (step.notice) {
    console.log(pc.yellow(`  ${step.notice}`));
  }

  if (step.kind === "confirm") {
    const accepted = await ask(confirm({ message: step.message, initialValue: false }));
    return accepted === null ? null : accepted ? first.id : undefined;
  }

  const initialValue = getStepInitialValue(step, options) ?? NONE;
  const choice = await ask(
    select<string>({
      message: step.message,
      options: [
        ...options.map((recipe) => {
          const hint = recipeOptionHint(recipe);
          return {
            value: recipe.id,
            label: recipe.name,
            ...(hint ? { hint } : {}),
          };
        }),
        { value: NONE, label: step.noneLabel },
      ],
      initialValue,
    }),
  );
  return choice === null ? null : choice === NONE ? undefined : choice;
}

async function promptRecipes(template: TemplateConfig): Promise<string[] | null> {
  const defaults = defaultRecipeIdsForScope(template.scope);
  if (defaults.length > 0) {
    console.log(
      pc.dim(
        `  Auto-included for ${template.scope}: ${defaults.join(", ")} (not shown in prompts)`,
      ),
    );
  }

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
      options: getAllTemplateIds().map((id) => {
        const template = getTemplate(id);
        if (!template) {
          return { value: id, label: id };
        }
        return {
          value: id,
          label: templateOptionLabel(template),
          hint: templateOptionHint(template),
        };
      }),
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

  const withDefaults = withDefaultRecipes(template.scope, picked);
  const resolved = resolveRecipeDependencies(withDefaults);
  const recipeIds = resolved.ok ? resolved.recipeIds : withDefaults;
  const selectedSet = new Set(picked);
  const autoInjectedIds = recipeIds.filter((id) => !selectedSet.has(id));

  const summary = formatSelectionSummary({
    projectName,
    template,
    selectedIds: picked,
    autoInjectedIds,
  });
  console.log(
    `\n${pc.bold("Summary")}\n${summary
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  );

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
