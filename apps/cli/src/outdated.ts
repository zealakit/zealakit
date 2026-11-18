import path from "node:path";
import { computeOutdated, ExitCode, type OutdatedReport } from "@zealakit/core/internal";
import type { Command } from "commander";
import pc from "picocolors";
import { printInfo, printValidationErrors } from "./output.js";

function formatReport(report: OutdatedReport): string {
  const lines: string[] = [];
  const kit = report.kitVersion;
  lines.push(
    kit.status === "same"
      ? `zealakit ${kit.installed} (project generated with the same version)`
      : kit.status === "behind"
        ? `Project was generated with zealakit ${kit.project}; you have ${kit.installed}.`
        : `Project was generated with zealakit ${kit.project}, newer than the installed ${kit.installed}.`,
  );
  lines.push("");
  if (report.entries.length === 0) {
    lines.push(
      pc.green("Every template/recipe dependency matches what the installed kit would generate."),
    );
    return lines.join("\n");
  }
  const rows = report.entries.map((entry) => [
    entry.package,
    entry.project,
    entry.kit,
    entry.source,
    entry.status,
  ]);
  const header = ["package", "project", "kit", "source", "status"];
  const widths = header.map((title, i) =>
    Math.max(title.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const format = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  lines.push(pc.bold(format(header)));
  for (const row of rows) {
    const status =
      row[4] === "behind"
        ? pc.yellow(row[4])
        : row[4] === "ahead"
          ? pc.cyan(row[4])
          : (row[4] ?? "");
    lines.push(format([...row.slice(0, 4).map((cell) => cell ?? ""), ""]).trimEnd() + status);
  }
  lines.push(
    "",
    pc.dim(
      "Report only: edit package.json (or go.mod) yourself, or re-run the kit's recipes with `zealakit add`.",
    ),
  );
  return lines.join("\n");
}

/** `zealakit outdated` — compare a project's dependency ranges with the installed kit's. */
export function registerOutdatedCommand(program: Command): void {
  program
    .command("outdated")
    .description(
      "Compare this project's template/recipe dependency ranges with the installed kit (report only)",
    )
    .option("--cwd <dir>", "Project directory (default: current directory)")
    .option("--json", "Machine-readable output")
    .action((options: { cwd?: string; json?: boolean }) => {
      const report = computeOutdated(path.resolve(options.cwd ?? process.cwd()));
      if (report.blockers.length > 0) {
        if (options.json)
          printInfo(
            JSON.stringify(
              { ok: false, error: { code: "validation", messages: report.blockers } },
              null,
              2,
            ),
          );
        else printValidationErrors(report.blockers);
        process.exit(ExitCode.VALIDATION);
      }
      printInfo(
        options.json ? JSON.stringify({ ok: true, ...report }, null, 2) : formatReport(report),
      );
    });
}
