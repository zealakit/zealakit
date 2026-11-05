import type { DiscoveryFeedbackStats, DiscoveryFeedbackStatusReport } from "./types.js";

function pct(rate: number | null): string {
  if (rate === null) return "n/a";
  return `${Math.round(rate * 100)}%`;
}

function formatTop(entries: Array<{ id: string; count: number }>, empty: string): string {
  if (entries.length === 0) return empty;
  return entries.map((entry) => `  ${entry.id} (${entry.count})`).join("\n");
}

/** Human-readable local stats for `zealakit discovery stats`. */
export function formatDiscoveryFeedbackStats(stats: DiscoveryFeedbackStats): string {
  if (stats.totalSessions === 0) {
    return [
      "No local Discovery feedback yet.",
      "",
      "Run `zealakit create --discover` to record sessions locally (IDs only, no project paths).",
      "Disable anytime: `zealakit discovery feedback disable`",
    ].join("\n");
  }

  const lines = [
    "Local Discovery feedback (offline)",
    "",
    `Sessions:              ${stats.totalSessions}`,
    `  Completed:           ${stats.completedSessions}`,
    `  Cancelled:           ${stats.cancelledSessions}`,
    `  No compatible match: ${stats.noMatchSessions}`,
    `  Generation failed:   ${stats.generationFailedSessions}`,
    "",
    `Generation success:    ${pct(stats.generationSuccessRate)} (${stats.generationAttempts} attempts)`,
    `Changed recommendations: ${pct(stats.recommendationChangeRate)}`,
    `Overrode top template: ${pct(stats.firstTemplateOverrideRate)}`,
    "",
    "Most selected templates:",
    formatTop(stats.mostSelectedTemplates, "  (none)"),
    "",
    "Most selected recipes:",
    formatTop(stats.mostSelectedRecipes, "  (none)"),
  ];

  if (stats.signals.length > 0) {
    lines.push("", "Diagnostic signals (not proof of scoring bugs):");
    for (const signal of stats.signals) {
      lines.push(`  - ${signal}`);
    }
  }

  return lines.join("\n");
}

export function formatDiscoveryFeedbackStatus(report: DiscoveryFeedbackStatusReport): string {
  return [
    `Local feedback: ${report.enabled ? "enabled" : "disabled"}`,
    `Store: ${report.storePath}`,
    `Sessions retained: ${report.sessionCount}`,
  ].join("\n");
}
