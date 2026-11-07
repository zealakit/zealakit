import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  text,
} from "@clack/prompts";
import {
  createProjectNaming,
  type DiscoveryAnswers,
  type DiscoverySessionDraft,
  didChangeDiscoveryRecommendations,
  formatNoCompatibleTemplateMessage,
  getTemplate,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  type ProjectNaming,
  recordDiscoverySession,
  resolveRecipeDependencies,
  type ScaffoldConfig,
  validateDiscoveryAnswers,
  withDefaultRecipes,
} from "@zealakit/core";
import { isValidNpmPackageName } from "@zealakit/ecosystem-node";
import pc from "picocolors";
import {
  buildRecipeChoices,
  buildTemplateChoices,
  defaultSelectedRecipeIds,
  formatDiscoverySummary,
  formatTemplateDetails,
} from "./present.js";
import { runDiscoveryQuestionnaire } from "./questionnaire.js";

async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol> | null> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel("Cancelled.");
    return null;
  }
  return value as Exclude<T, symbol>;
}

/**
 * Final Discovery stage: name the project after recommendations are accepted.
 * Does not re-run matching. Optional CLI `projectName` arg pre-fills / skips the prompt.
 */
async function promptProjectNaming(initialName?: string): Promise<ProjectNaming | null> {
  if (initialName) {
    if (!isValidNpmPackageName(initialName)) {
      console.log(
        pc.red(
          "  Invalid project name from the command line. Use lowercase letters, no spaces (npm naming rules).",
        ),
      );
      // Fall through to interactive rename rather than aborting the whole session.
    } else {
      return createProjectNaming(initialName);
    }
  }

  const name = await ask(
    text({
      message: "What is your project name?",
      placeholder: "my-app",
      validate: (value) => {
        const trimmed = value?.trim() ?? "";
        if (!trimmed) {
          return "Project name cannot be empty.";
        }
        if (!isValidNpmPackageName(trimmed)) {
          return "Invalid name. Use lowercase letters, no spaces (npm naming rules).";
        }
      },
    }),
  );
  if (name === null) {
    return null;
  }
  return createProjectNaming(name.trim());
}

type ReviewAction = "create" | "recipes" | "template" | "answers" | "cancel";

async function promptReview(summary: string): Promise<ReviewAction | null> {
  console.log(
    `\n${pc.bold("Recommended setup")}\n${summary
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  );

  return ask(
    select<ReviewAction>({
      message: "Continue with this setup?",
      options: [
        { value: "create", label: "Yes — name the project and create" },
        { value: "recipes", label: "Change recipes" },
        { value: "template", label: "Change template" },
        { value: "answers", label: "Adjust discovery answers" },
        { value: "cancel", label: "Cancel" },
      ],
      initialValue: "create",
    }),
  );
}

export type DiscoveryPromptResult = {
  config: ScaffoldConfig | null;
  /** Present when a Discovery session started; finalize after generation when config is set. */
  feedback: DiscoverySessionDraft | null;
  /** Set when the user reached the naming stage (even if they cancel before writing). */
  naming?: ProjectNaming | null;
};

function createDraft(startedAtMs: number): DiscoverySessionDraft {
  return {
    startedAtMs,
    recommendedTemplateIds: [],
    recommendedRecipeIds: [],
    selectedRecipeIds: [],
    changedRecommendations: false,
    hadCompatibleTemplate: false,
    status: "cancelled",
  };
}

function finalizeDraft(draft: DiscoverySessionDraft): DiscoverySessionDraft {
  return {
    ...draft,
    changedRecommendations: didChangeDiscoveryRecommendations({
      recommendedTemplateIds: draft.recommendedTemplateIds,
      selectedTemplateId: draft.selectedTemplateId,
      recommendedRecipeIds: draft.recommendedRecipeIds,
      selectedRecipeIds: draft.selectedRecipeIds,
    }),
  };
}

function persistTerminalDraft(draft: DiscoverySessionDraft): void {
  recordDiscoverySession(finalizeDraft(draft));
}

/**
 * Interactive Project Discovery flow → ScaffoldConfig for the existing pipeline.
 *
 * Order: questionnaire → recommendations → review → **project naming** → generation config.
 */
export async function runDiscoveryPrompts(initial: {
  projectName?: string;
  /** When false, caller already printed an intro (e.g. mode picker). Default true. */
  showIntro?: boolean;
}): Promise<DiscoveryPromptResult> {
  const draft = createDraft(Date.now());

  if (initial.showIntro !== false) {
    intro(`${pc.bgCyan(pc.black(" zealakit "))} Project Discovery`);
  } else {
    console.log(pc.bold("Project Discovery"));
  }

  note(
    [
      "First we ask what you are building, then recommend a template and recipes.",
      "You can change any recommendation before files are written.",
      "We ask for the project name only after you accept a setup.",
      "Local feedback (IDs only) helps improve Discovery — `zealakit discovery stats`.",
    ].join("\n"),
    "How it works",
  );

  let answers: DiscoveryAnswers = {};
  let templateId: string | undefined;
  let recipeIds: string[] = [];
  let step: "answers" | "template" | "recipes" | "review" = "answers";

  while (true) {
    if (step === "answers") {
      const collected = await runDiscoveryQuestionnaire(answers);
      if (collected === null) {
        persistTerminalDraft(draft);
        return { config: null, feedback: null };
      }
      answers = collected;

      const validation = validateDiscoveryAnswers(answers);
      if (!validation.valid) {
        console.log(pc.red(validation.errors.map((error) => `  ${error}`).join("\n")));
        continue;
      }

      const normalized = normalizeDiscoveryAnswers(answers);
      if (!normalized.ok) {
        console.log(pc.red(normalized.errors.map((error) => `  ${error}`).join("\n")));
        continue;
      }

      const discovery = matchDiscovery(normalized.requirements);
      const choices = buildTemplateChoices(discovery);
      draft.recommendedTemplateIds = choices.map((choice) => choice.value);
      draft.hadCompatibleTemplate = choices.length > 0;
      draft.selectedTemplateId = undefined;
      draft.recommendedRecipeIds = [];
      draft.selectedRecipeIds = [];

      if (choices.length === 0) {
        draft.status = "no_match";
        console.log(
          `\n${pc.yellow(formatNoCompatibleTemplateMessage(discovery).replace(/^/gm, "  "))}\n`,
        );
        const retry = await ask(confirm({ message: "Adjust your answers?", initialValue: true }));
        if (!retry) {
          cancel("Cancelled.");
          persistTerminalDraft(draft);
          return { config: null, feedback: null };
        }
        draft.status = "cancelled";
        continue;
      }

      console.log(pc.bold("\nRecommended templates"));
      for (const [index, choice] of choices.slice(0, 5).entries()) {
        const mark = index === 0 ? ">" : " ";
        console.log(`${mark} ${index + 1}. ${choice.label}`);
        if (choice.hint) {
          console.log(pc.dim(`     ${choice.hint}`));
        }
        for (const line of formatTemplateDetails(choice.match).split("\n").slice(1, 3)) {
          console.log(pc.dim(`     ${line}`));
        }
      }
      console.log("");

      templateId = undefined;
      recipeIds = [];
      step = "template";
      continue;
    }

    const normalized = normalizeDiscoveryAnswers(answers);
    if (!normalized.ok) {
      step = "answers";
      continue;
    }
    const requirements = normalized.requirements;

    if (step === "template") {
      const choices = buildTemplateChoices(matchDiscovery(requirements));
      if (choices.length === 0) {
        step = "answers";
        continue;
      }

      const selected = await ask(
        select<string>({
          message: "Select a Template:",
          options: choices.map((choice) => ({
            value: choice.value,
            label: choice.label,
            ...(choice.hint ? { hint: choice.hint } : {}),
          })),
          initialValue: templateId ?? choices[0]?.value,
        }),
      );
      if (selected === null) {
        persistTerminalDraft(draft);
        return { config: null, feedback: null };
      }
      templateId = selected;
      draft.selectedTemplateId = selected;
      recipeIds = [];
      step = "recipes";
      continue;
    }

    if (step === "recipes") {
      if (!templateId) {
        step = "template";
        continue;
      }
      const discovery = matchDiscovery(requirements, { templateId });
      const choices = buildRecipeChoices(discovery);
      const recommended = defaultSelectedRecipeIds(discovery).filter((id) =>
        choices.some((choice) => choice.value === id),
      );
      draft.recommendedRecipeIds = recommended;
      const initialValues =
        recipeIds.length > 0
          ? recipeIds.filter((id) => choices.some((choice) => choice.value === id))
          : recommended;

      if (choices.length === 0) {
        console.log(pc.dim("  No extra recipes needed for this project."));
        recipeIds = [];
        draft.selectedRecipeIds = [];
      } else {
        console.log(pc.bold("\nRecommended recipes"));
        console.log(
          pc.dim("  Checked items are suggested for your answers. Uncheck any you do not want.\n"),
        );

        const selected = await ask(
          multiselect({
            message: "Select Recipes:",
            options: choices.map((choice) => ({
              value: choice.value,
              label: choice.label,
              ...(choice.hint ? { hint: choice.hint } : {}),
            })),
            initialValues,
            required: false,
          }),
        );
        if (selected === null) {
          persistTerminalDraft(draft);
          return { config: null, feedback: null };
        }
        recipeIds = selected;
        draft.selectedRecipeIds = selected;
      }
      step = "review";
      continue;
    }

    if (!templateId) {
      step = "template";
      continue;
    }

    const template = getTemplate(templateId);
    if (!template) {
      console.log(pc.red(`  Template '${templateId}' is not registered.`));
      step = "template";
      continue;
    }

    const withDefaults = withDefaultRecipes(template.scope, recipeIds);
    const resolved = resolveRecipeDependencies(withDefaults);
    const finalRecipeIds = resolved.ok ? resolved.recipeIds : withDefaults;
    const selectedSet = new Set(recipeIds);
    const autoInjectedIds = finalRecipeIds.filter((id) => !selectedSet.has(id));

    const summary = formatDiscoverySummary({
      templateId,
      recipeIds: finalRecipeIds,
      autoInjectedIds,
    });
    const action = await promptReview(summary);
    if (action === null || action === "cancel") {
      if (action === "cancel") {
        cancel("Cancelled.");
      }
      persistTerminalDraft(draft);
      return { config: null, feedback: null };
    }
    if (action === "answers") {
      step = "answers";
      continue;
    }
    if (action === "template") {
      step = "template";
      continue;
    }
    if (action === "recipes") {
      step = "recipes";
      continue;
    }

    // Naming is the last interactive stage — does not re-run matching.
    const naming = await promptProjectNaming(initial.projectName);
    if (naming === null) {
      persistTerminalDraft(draft);
      return { config: null, feedback: null, naming: null };
    }

    outro(pc.green("Creating project..."));
    const readyDraft = finalizeDraft({
      ...draft,
      selectedTemplateId: templateId,
      selectedRecipeIds: recipeIds,
      status: "cancelled",
    });
    return {
      config: {
        projectName: naming.projectName,
        templateId,
        recipeIds: finalRecipeIds,
      },
      feedback: readyDraft,
      naming,
    };
  }
}
