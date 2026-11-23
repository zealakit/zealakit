import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { confirm, isCancel } from "@clack/prompts";
import {
  type AddPlan,
  applyAddPlan,
  detectPackageManager,
  ExitCode,
  getManifestAdapterForConfig,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  planAddRecipes,
  readStackManifest,
  stackMemberDir,
  validateRecipeIds,
} from "@zealakit/core/internal";
import type { Command } from "commander";
import pc from "picocolors";

import {
  describeExternals,
  loadExternalSpecs,
  loadProjectExternals,
  splitRecipeList,
} from "./external.js";
import {
  failDiagnostic,
  printError,
  printInfo,
  printValidationErrors,
  printWarning,
} from "./output.js";

export type AddOptions = {
  cwd?: string;
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  overwriteFiles?: boolean;
  install?: boolean;
  pm?: string;
  json?: boolean;
  trustExternal?: boolean;
  /** Stack member to add to (workspace projects). */
  app?: string;
};

const LOCKFILES: Array<[string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

function projectPackageManager(dir: string, flag: string | undefined): PackageManager {
  if (flag !== undefined) {
    if (!isPackageManager(flag)) {
      failDiagnostic(
        {
          title: "Invalid usage",
          reason: `Unknown package manager '${flag}'.`,
          resolution: `Use one of: ${PACKAGE_MANAGERS.join(", ")}.`,
        },
        ExitCode.USAGE,
      );
    }
    return flag;
  }
  for (const [file, pm] of LOCKFILES) {
    if (fs.existsSync(path.join(dir, file))) return pm;
  }
  return detectPackageManager(process.env.npm_config_user_agent);
}

/** `dirty` when inside a git work tree with uncommitted changes; `none` when not a repo. */
function gitState(dir: string): "clean" | "dirty" | "none" {
  const probe = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: dir,
    encoding: "utf-8",
  });
  if (probe.error || probe.status !== 0 || probe.stdout.trim() !== "true") return "none";
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf-8" });
  return status.status === 0 && status.stdout.trim() === "" ? "clean" : "dirty";
}

function colorDiff(diff: string): string {
  return diff
    .split("\n")
    .map((line) =>
      line.startsWith("+") && !line.startsWith("+++")
        ? pc.green(line)
        : line.startsWith("-") && !line.startsWith("---")
          ? pc.red(line)
          : line.startsWith("@@")
            ? pc.cyan(line)
            : line,
    )
    .join("\n");
}

function formatPreview(plan: AddPlan): string {
  const lines: string[] = [pc.bold("Zealakit — Add Preview"), ""];
  lines.push(`Project  ${plan.projectDir}`, `Template ${plan.manifest.template}`);
  lines.push(`Adding   ${plan.added.join(", ")}`);
  if (plan.autoInjected.length > 0) lines.push(`Also     ${plan.autoInjected.join(", ")} (auto)`);
  if (plan.alreadyApplied.length > 0)
    lines.push(`Skipping ${plan.alreadyApplied.join(", ")} (already applied)`);
  lines.push("");

  const created = plan.changes.filter((c) => c.kind === "create");
  const modified = plan.changes.filter((c) => c.kind === "modify");
  const conflicts = plan.changes.filter((c) => c.kind === "conflict");
  if (created.length > 0) {
    lines.push(pc.bold(`Create (${created.length})`));
    for (const change of created) lines.push(`  + ${change.path}`);
    lines.push("");
  }
  if (modified.length > 0) {
    lines.push(pc.bold(`Modify (${modified.length})`));
    for (const change of modified) {
      lines.push(`  ~ ${change.path}`);
      if (change.diff) lines.push(colorDiff(change.diff).replace(/^/gm, "    ").trimEnd());
    }
    lines.push("");
  }
  const pkg = plan.packageChanges;
  const pkgParts = [
    pkg.dependencies.length
      ? `${pkg.dependencies.length} dependencies (${pkg.dependencies.join(", ")})`
      : "",
    pkg.devDependencies.length
      ? `${pkg.devDependencies.length} devDependencies (${pkg.devDependencies.join(", ")})`
      : "",
    pkg.scripts.length ? `scripts: ${pkg.scripts.join(", ")}` : "",
  ].filter(Boolean);
  if (pkgParts.length > 0) {
    lines.push(pc.bold("package.json"), ...pkgParts.map((part) => `  + ${part}`), "");
  }
  if (conflicts.length > 0) {
    lines.push(pc.yellow(pc.bold(`Needs your attention (${conflicts.length}) — kept as is`)));
    for (const change of conflicts) {
      lines.push(`  ! ${change.path}`, `    ${change.note ?? ""}`);
      if (change.diff) lines.push(colorDiff(change.diff).replace(/^/gm, "    ").trimEnd());
    }
    lines.push("");
  }
  if (plan.changes.length === 0) lines.push("No file changes needed.", "");
  for (const warning of plan.warnings) lines.push(pc.yellow(`⚠ ${warning}`));
  return lines.join("\n");
}

function jsonPlan(plan: AddPlan) {
  return {
    template: plan.manifest?.template,
    added: plan.added,
    autoInjected: plan.autoInjected,
    alreadyApplied: plan.alreadyApplied,
    changes: plan.changes.map((change) => ({
      path: change.path,
      kind: change.kind,
      diff: change.diff,
      note: change.note,
    })),
    packageChanges: plan.packageChanges,
    warnings: plan.warnings,
  };
}

function emit(json: boolean | undefined, value: unknown, human: () => void): void {
  if (json) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else human();
}

async function ask(message: string): Promise<boolean> {
  const answer = await confirm({ message, initialValue: true });
  if (isCancel(answer)) process.exit(ExitCode.OK);
  return answer;
}

export async function runAdd(recipeIds: string[], options: AddOptions): Promise<void> {
  const json = options.json === true;
  let dir = path.resolve(options.cwd ?? process.cwd());
  const fail = (code: ExitCode, messages: string[]): never => {
    if (json) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, error: { code: code === ExitCode.USAGE ? "usage" : code === ExitCode.VALIDATION ? "validation" : "internal", messages } }, null, 2)}\n`,
      );
    } else {
      printValidationErrors(messages);
    }
    process.exit(code);
  };

  // A stack root only indexes its apps: recipes are added to one member project.
  const stack = readStackManifest(dir);
  if (stack?.ok) {
    const member = options.app ? stackMemberDir(dir, stack.manifest, options.app) : undefined;
    if (!member) {
      fail(ExitCode.USAGE, [
        `This is a stack workspace; choose an app with --app <name> (${Object.keys(stack.manifest.stack).join(", ")}).`,
      ]);
    } else {
      dir = member;
    }
  } else if (options.app) {
    fail(ExitCode.USAGE, [
      "--app only applies to stack workspaces (a root zealakit.json with schemaVersion 2).",
    ]);
  }

  // Recipes the project was generated with from outside the kit must be known to plan.
  const restored = await loadProjectExternals(dir);
  if (restored.errors.length > 0) fail(ExitCode.VALIDATION, restored.errors);

  const split = splitRecipeList([...new Set(recipeIds)]);
  const loaded = await loadExternalSpecs(split.external, dir);
  if (loaded.errors.length > 0) fail(ExitCode.VALIDATION, loaded.errors);
  const unique = [...split.builtin, ...loaded.recipes.map((recipe) => recipe.id)];
  const idsCheck = validateRecipeIds(unique);
  if (!idsCheck.valid) fail(ExitCode.VALIDATION, idsCheck.errors);

  if (!options.dryRun && !options.yes && !process.stdin.isTTY) {
    fail(ExitCode.USAGE, [
      "`zealakit add` needs confirmation: run it in a terminal, or pass -y (or --dry-run).",
    ]);
  }
  if (json && !options.dryRun && !options.yes) {
    fail(ExitCode.USAGE, ["--json is non-interactive: pass -y to apply, or --dry-run to preview."]);
  }

  const git = gitState(dir);
  if (git === "dirty" && !options.force && !options.dryRun) {
    fail(ExitCode.VALIDATION, [
      "The git working tree has uncommitted changes. Commit or stash them first so the changes are easy to review, or pass --force.",
    ]);
  }
  if (git === "none" && !json) {
    printWarning("⚠ Not a git repository: there is no easy way to undo these changes.");
  }

  let plan: AddPlan;
  try {
    plan = planAddRecipes(dir, unique, { packageManager: projectPackageManager(dir, options.pm) });
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(ExitCode.INTERNAL);
  }
  if (plan.blockers.length > 0) fail(ExitCode.VALIDATION, plan.blockers);

  if (plan.added.length === 0) {
    emit(json, { ok: true, ...jsonPlan(plan), applied: false }, () =>
      printInfo(`Nothing to add: ${plan.alreadyApplied.join(", ")} already applied.`),
    );
    process.exit(ExitCode.OK);
  }

  if (options.dryRun) {
    emit(json, { ok: true, dryRun: true, ...jsonPlan(plan) }, () => printInfo(formatPreview(plan)));
    process.exit(ExitCode.OK);
  }

  if (!json) printInfo(formatPreview(plan));

  if (loaded.recipes.length > 0 && !options.trustExternal) {
    if (options.yes || json || !process.stdin.isTTY) {
      fail(ExitCode.USAGE, [
        "External recipes need confirmation: pass --trust-external to apply them non-interactively.",
      ]);
    }
    printInfo(describeExternals(loaded.recipes));
    if (!(await ask("Apply these external recipes?"))) {
      printInfo("Cancelled; no files were changed.");
      process.exit(ExitCode.OK);
    }
  }

  if (!options.yes && !(await ask("Apply these changes?"))) {
    printInfo("Cancelled; no files were changed.");
    process.exit(ExitCode.OK);
  }

  const result = applyAddPlan(plan, { overwriteFiles: options.overwriteFiles === true });

  const depsChanged =
    plan.packageChanges.dependencies.length + plan.packageChanges.devDependencies.length > 0;
  const packageManager = projectPackageManager(dir, options.pm);
  let installState: "skipped" | "ok" | "failed" = "skipped";
  const adapter = getManifestAdapterForConfig(plan.config);
  const wantsInstall =
    options.install ??
    (depsChanged && !json && !options.yes && process.stdin.isTTY
      ? await ask("Install dependencies now?")
      : false);
  if (wantsInstall && adapter.postGenerate) {
    const post = await adapter.postGenerate(dir, plan.config, { packageManager, install: true });
    installState = post.install;
    if (post.install === "failed")
      printWarning(`⚠ Install failed: ${post.message ?? "unknown error"}`);
  }
  const steps = adapter.nextSteps(plan.config, {
    packageManager,
    installed: installState === "ok",
  });

  emit(
    json,
    {
      ok: true,
      applied: true,
      ...jsonPlan(plan),
      result,
      install: installState,
      nextSteps: depsChanged && installState !== "ok" ? steps.commands.slice(0, 1) : [],
    },
    () => {
      printInfo("");
      printInfo(
        `${pc.green("✔")} Added ${pc.cyan(plan.added.join(", "))}: ${result.created.length} created, ${result.modified.length} modified${result.overwritten.length ? `, ${result.overwritten.length} overwritten` : ""}.`,
      );
      if (result.skippedConflicts.length > 0) {
        printWarning(
          `⚠ ${result.skippedConflicts.length} file(s) kept as you had them: ${result.skippedConflicts.join(", ")}. Apply the patches shown above by hand, or re-run with --overwrite-files.`,
        );
      }
      if (depsChanged && installState !== "ok") {
        printInfo(
          `${pc.bold("Next:")} ${pc.cyan(steps.commands[0] ?? `${packageManager} install`)}`,
        );
      }
      printInfo("");
    },
  );
  process.exit(ExitCode.OK);
}

/** `zealakit add <recipe...>` — add recipes to an existing zealakit project. */
export function registerAddCommand(program: Command): void {
  program
    .command("add <recipes...>")
    .description("Add recipes to an existing project (reads zealakit.json; previews a diff first)")
    .option("--cwd <dir>", "Project directory (default: current directory)")
    .option("--dry-run", "Show what would change without writing")
    .option("-y, --yes", "Apply without asking for confirmation")
    .option("--force", "Proceed even when the git working tree is dirty")
    .option(
      "--overwrite-files",
      "Replace files you edited with the kit's version (originals are backed up)",
    )
    .option("--install", "Install dependencies afterwards")
    .option("--no-install", "Do not install dependencies")
    .option(
      "--pm <manager>",
      `Package manager for install (${PACKAGE_MANAGERS.join(", ")}; default: from lockfile)`,
    )
    .option("--app <name>", "Stack member to add to (workspace projects)")
    .option("--trust-external", "Apply external (path or github:) recipes without asking")
    .option("--json", "Machine-readable output (needs -y or --dry-run)")
    .action(async (recipes: string[], options: AddOptions) => {
      await runAdd(recipes, options);
    });
}
