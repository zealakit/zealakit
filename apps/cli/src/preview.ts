import { planIsReady, type ScaffoldPlan } from "@zealakit/core";
import pc from "picocolors";

/** Human-readable dry-run preview; matches the existing CLI picocolors style. */
export function formatScaffoldPreview(plan: ScaffoldPlan): string {
  const lines: string[] = [];
  const ready = planIsReady(plan);

  lines.push(pc.bold("Zealakit — Generation Preview"));
  lines.push("");
  lines.push(pc.bold("Project"));
  lines.push(`  Name: ${plan.config.projectName}`);
  lines.push(`  Template: ${plan.config.templateId}`);
  if (plan.destinationExists) {
    lines.push(`  ${pc.yellow("Destination exists (overwrite required)")}`);
  }
  lines.push("");

  lines.push(pc.bold("Recipes"));
  for (const id of plan.selectedIds) {
    lines.push(`  ${pc.green("✓")} ${id}`);
  }
  for (const id of plan.autoInjected) {
    lines.push(`  ${pc.green("✓")} ${id} ${pc.dim("(auto)")}`);
  }
  if (plan.selectedIds.length === 0 && plan.autoInjected.length === 0) {
    lines.push(`  ${pc.dim("(none)")}`);
  }
  lines.push("");

  const creates = plan.files.filter((f) => f.action === "create").length;
  const replaces = plan.files.filter((f) => f.action === "replace").length;
  const transforms = plan.files.filter(
    (f) => f.action === "transform" || f.action === "append",
  ).length;
  lines.push(pc.bold("Files"));
  lines.push(`  + ${creates} create`);
  lines.push(`  ~ ${replaces} replace`);
  lines.push(`  ✎ ${transforms} transform/append`);
  lines.push("");

  lines.push(pc.bold("Dependencies"));
  lines.push(`  + ${plan.packages.addedDependencies.length} packages`);
  lines.push(`  + ${plan.packages.addedDevDependencies.length} devDependencies`);
  lines.push("");

  lines.push(pc.bold("Scripts"));
  if (plan.packages.addedScripts.length === 0) {
    lines.push(`  ${pc.dim("(none)")}`);
  } else {
    for (const name of plan.packages.addedScripts) {
      lines.push(`  + ${name}`);
    }
  }
  lines.push("");

  lines.push(pc.bold("Validation"));
  for (const check of plan.checks) {
    const mark = check.ok ? pc.green("✓") : pc.red("✖");
    const detail = check.detail ? pc.dim(` — ${check.detail}`) : "";
    lines.push(`  ${mark} ${check.id}${detail}`);
  }
  lines.push("");

  if (plan.warnings.length > 0) {
    lines.push(pc.bold(pc.yellow("Warnings")));
    for (const warning of plan.warnings) {
      lines.push(`  ${pc.yellow("!")} ${warning}`);
    }
    lines.push("");
  }

  if (plan.blockers.length > 0) {
    lines.push(pc.bold(pc.red("Blockers")));
    for (const blocker of plan.blockers) {
      lines.push(`  ${pc.red(blocker)}`);
    }
    lines.push("");
  }

  lines.push(pc.bold("Result"));
  lines.push(ready ? `  ${pc.green("Ready to scaffold")}` : `  ${pc.red("Cannot scaffold")}`);
  lines.push("");
  lines.push(pc.dim("No files were written."));
  return lines.join("\n");
}
