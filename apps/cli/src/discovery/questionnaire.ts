import { cancel, isCancel, multiselect, note, select } from "@clack/prompts";
import {
  type DiscoveryAnswers,
  type DiscoveryQuestion,
  formatUnsupportedProjectTypeMessage,
  getQuestionOptions,
  getVisibleQuestions,
  NO_PREFERENCE,
  pruneDiscoveryAnswers,
} from "@zealakit/core";
import pc from "picocolors";

async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol> | null> {
  const value = await prompt;
  if (isCancel(value)) {
    cancel("Cancelled.");
    return null;
  }
  return value as Exclude<T, symbol>;
}

function withNoPreference(
  question: DiscoveryQuestion,
  options: { value: string; label: string; hint?: string }[],
) {
  if (!question.allowNoPreference) {
    return options;
  }
  return [
    ...options,
    {
      value: NO_PREFERENCE,
      label: question.noPreferenceLabel ?? "Recommend for me",
    },
  ];
}

async function askQuestion(
  question: DiscoveryQuestion,
  answers: DiscoveryAnswers,
  progress: { index: number; total: number },
): Promise<"cancel" | "ok" | "unsupported"> {
  const options = withNoPreference(
    question,
    getQuestionOptions(question, answers).map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.hint ? { hint: option.hint } : {}),
    })),
  );

  console.log(pc.dim(`  Question ${progress.index} of ${progress.total}`));
  if (question.description) {
    console.log(pc.dim(`  ${question.description}`));
  }

  if (question.type === "multi-select") {
    if (options.length === 0) {
      (answers as Record<string, unknown>)[question.id] = [];
      return "ok";
    }
    const current = answers[question.id];
    const initialValues = Array.isArray(current) ? [...current] : [];
    const choice = await ask(
      multiselect({
        message: question.prompt,
        options,
        initialValues,
        required: false,
      }),
    );
    if (choice === null) {
      return "cancel";
    }
    (answers as Record<string, unknown>)[question.id] = choice;
    return "ok";
  }

  const current = answers[question.id];
  const initialValue =
    typeof current === "string"
      ? current
      : question.allowNoPreference
        ? NO_PREFERENCE
        : options[0]?.value;

  const choice = await ask(
    select<string>({
      message: question.prompt,
      options,
      initialValue,
    }),
  );
  if (choice === null) {
    return "cancel";
  }
  (answers as Record<string, unknown>)[question.id] = choice;

  if (question.id === "projectType" && choice === "complete-product") {
    note(formatUnsupportedProjectTypeMessage(), "Coming soon");
    cancel("Complete Product is not available yet.");
    return "unsupported";
  }

  return "ok";
}

/**
 * Walk visible Discovery questions, re-evaluating conditions after each answer.
 * Progress counts only the active branch. Previous answers are used as defaults when re-running.
 */
export async function runDiscoveryQuestionnaire(
  initial: DiscoveryAnswers = {},
): Promise<DiscoveryAnswers | null> {
  const answers: DiscoveryAnswers = { ...initial };
  const asked = new Set<string>();

  while (true) {
    const pruned = pruneDiscoveryAnswers(answers);
    for (const key of Object.keys(answers) as (keyof DiscoveryAnswers)[]) {
      if (!(key in pruned)) {
        delete answers[key];
        asked.delete(key);
      }
    }
    Object.assign(answers, pruned);

    const visible = getVisibleQuestions(answers);
    const next = visible.find((question) => !asked.has(question.id));
    if (!next) {
      break;
    }

    const progress = {
      index: asked.size + 1,
      total: Math.max(visible.length, asked.size + 1),
    };
    const status = await askQuestion(next, answers, progress);
    if (status === "cancel" || status === "unsupported") {
      return null;
    }
    asked.add(next.id);
  }

  return pruneDiscoveryAnswers(answers);
}
