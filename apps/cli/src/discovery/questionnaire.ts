import { cancel, isCancel, multiselect, select } from "@clack/prompts";
import {
  type DiscoveryAnswers,
  type DiscoveryQuestion,
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
  return [...options, { value: NO_PREFERENCE, label: "No preference" }];
}

async function askQuestion(
  question: DiscoveryQuestion,
  answers: DiscoveryAnswers,
): Promise<"cancel" | "ok"> {
  const options = withNoPreference(
    question,
    getQuestionOptions(question, answers).map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.hint ? { hint: option.hint } : {}),
    })),
  );

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
  return "ok";
}

/**
 * Walk visible Discovery questions, re-evaluating conditions after each answer.
 * Previous answers are used as defaults when re-running.
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

    const next = getVisibleQuestions(answers).find((question) => !asked.has(question.id));
    if (!next) {
      break;
    }

    const status = await askQuestion(next, answers);
    if (status === "cancel") {
      return null;
    }
    asked.add(next.id);
  }

  return pruneDiscoveryAnswers(answers);
}
