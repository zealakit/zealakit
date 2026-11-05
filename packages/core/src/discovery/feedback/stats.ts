import { resolveDiscoveryFeedbackPaths } from "./paths.js";
import {
  type DiscoveryFeedbackStoreOptions,
  isDiscoveryFeedbackEnabled,
  loadDiscoveryFeedbackStore,
} from "./store.js";
import type {
  DiscoveryFeedbackStats,
  DiscoveryFeedbackStatusReport,
  DiscoveryFeedbackStore,
  DiscoverySessionRecord,
} from "./types.js";

function countById(ids: Array<string | undefined>): Array<{ id: string; count: number }> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function buildSignals(sessions: DiscoverySessionRecord[]): string[] {
  const signals: string[] = [];
  if (sessions.length === 0) return signals;

  const withSelection = sessions.filter((s) => s.selectedTemplateId);
  const overrides = withSelection.filter((s) => {
    const top = s.recommendedTemplateIds[0];
    return Boolean(top && s.selectedTemplateId && s.selectedTemplateId !== top);
  });
  const overrideRate = rate(overrides.length, withSelection.length);
  if (overrideRate !== null && overrideRate >= 0.4 && withSelection.length >= 5) {
    signals.push(
      `Users often pick a non-top template (${Math.round(overrideRate * 100)}% of selections).`,
    );
  }

  const recipeChanges = withSelection.filter((s) => {
    const recommended = new Set(s.recommendedRecipeIds);
    const selected = new Set(s.selectedRecipeIds);
    if (recommended.size !== selected.size) return true;
    for (const id of selected) {
      if (!recommended.has(id)) return true;
    }
    return false;
  });
  const recipeChangeRate = rate(recipeChanges.length, withSelection.length);
  if (recipeChangeRate !== null && recipeChangeRate >= 0.4 && withSelection.length >= 5) {
    signals.push(
      `Users often change recommended recipes (${Math.round(recipeChangeRate * 100)}% of selections).`,
    );
  }

  const sawRecs = sessions.filter((s) => s.hadCompatibleTemplate);
  const cancelledAfterRecs = sawRecs.filter((s) => s.status === "cancelled");
  const cancelRate = rate(cancelledAfterRecs.length, sawRecs.length);
  if (cancelRate !== null && cancelRate >= 0.35 && sawRecs.length >= 5) {
    signals.push(
      `Cancellations after recommendations are common (${Math.round(cancelRate * 100)}%).`,
    );
  }

  const noMatch = sessions.filter((s) => s.status === "no_match" || !s.hadCompatibleTemplate);
  const noMatchRate = rate(noMatch.length, sessions.length);
  if (noMatchRate !== null && noMatchRate >= 0.2 && sessions.length >= 5) {
    signals.push(
      `No-compatible-template outcomes are frequent (${Math.round(noMatchRate * 100)}%).`,
    );
  }

  const genAttempts = sessions.filter((s) => typeof s.generationSucceeded === "boolean");
  const genFails = genAttempts.filter((s) => s.generationSucceeded === false);
  const failRate = rate(genFails.length, genAttempts.length);
  if (failRate !== null && failRate >= 0.15 && genAttempts.length >= 5) {
    const byTemplate = countById(genFails.map((s) => s.selectedTemplateId)).slice(0, 3);
    const detail =
      byTemplate.length > 0
        ? ` Most often: ${byTemplate.map((entry) => entry.id).join(", ")}.`
        : "";
    signals.push(
      `Generation failures are elevated (${Math.round(failRate * 100)}% of attempts).${detail}`,
    );
  }

  return signals;
}

export function computeDiscoveryFeedbackStats(
  store: DiscoveryFeedbackStore,
): DiscoveryFeedbackStats {
  const sessions = store.sessions;
  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const cancelledSessions = sessions.filter((s) => s.status === "cancelled").length;
  const noMatchSessions = sessions.filter((s) => s.status === "no_match").length;
  const generationFailedSessions = sessions.filter((s) => s.status === "generation_failed").length;
  const generationAttempts = sessions.filter(
    (s) => typeof s.generationSucceeded === "boolean",
  ).length;
  const generationSuccesses = sessions.filter((s) => s.generationSucceeded === true).length;

  const withSelection = sessions.filter((s) => s.selectedTemplateId);
  const changed = withSelection.filter((s) => s.changedRecommendations).length;
  const firstOverrides = withSelection.filter((s) => {
    const top = s.recommendedTemplateIds[0];
    return Boolean(top && s.selectedTemplateId && s.selectedTemplateId !== top);
  }).length;

  return {
    totalSessions: sessions.length,
    completedSessions,
    cancelledSessions,
    noMatchSessions,
    generationFailedSessions,
    generationAttempts,
    generationSuccessRate: rate(generationSuccesses, generationAttempts),
    recommendationChangeRate: rate(changed, withSelection.length),
    firstTemplateOverrideRate: rate(firstOverrides, withSelection.length),
    mostSelectedTemplates: countById(sessions.map((s) => s.selectedTemplateId)).slice(0, 8),
    mostSelectedRecipes: countById(sessions.flatMap((s) => s.selectedRecipeIds)).slice(0, 8),
    signals: buildSignals(sessions),
  };
}

export function getDiscoveryFeedbackStats(
  options: DiscoveryFeedbackStoreOptions = {},
): DiscoveryFeedbackStats {
  return computeDiscoveryFeedbackStats(loadDiscoveryFeedbackStore(options));
}

export function getDiscoveryFeedbackStatus(
  options: DiscoveryFeedbackStoreOptions = {},
): DiscoveryFeedbackStatusReport {
  const store = loadDiscoveryFeedbackStore(options);
  const storePath =
    options.storePath ?? resolveDiscoveryFeedbackPaths(options.env ?? process.env).storePath;
  return {
    enabled: isDiscoveryFeedbackEnabled(options),
    storePath,
    sessionCount: store.sessions.length,
  };
}
