import type { DiscoveryResult } from "./types.js";

/**
 * Human-readable explanation when no template is compatible.
 * Aggregates the most common hard-constraint failures (no scoring details).
 */
export function formatNoCompatibleTemplateMessage(result: DiscoveryResult): string {
  const incompatible = result.templates.filter((entry) => !entry.compatible);
  if (incompatible.length === 0) {
    return "No templates are registered to evaluate.";
  }

  const counts = new Map<string, number>();
  for (const entry of incompatible) {
    for (const failure of entry.reasons) {
      counts.set(failure.message, (counts.get(failure.message) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([message]) => message);

  const lines = [
    "No compatible template matches your answers.",
    "Common gaps across registered templates:",
    ...top.map((message) => `  - ${message}`),
    "Try relaxing a framework, runtime, or rendering preference.",
  ];
  return lines.join("\n");
}
