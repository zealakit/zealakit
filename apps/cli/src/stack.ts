import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  buildStackPlan,
  detectPackageManager,
  ExitCode,
  executeStackPlan,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  parseStackSpec,
  ScaffoldValidationError,
  type StackPlan,
} from "@zealakit/core/internal";
import pc from "picocolors";
import type { CliOptions } from "./options.js";
import {
  failDiagnostic,
  printError,
  printInfo,
  printValidationErrors,
  printWarning,
} from "./output.js";
import { initGitRepository } from "./post-generate.js";
import { resolveOverwritePolicy } from "./target-dir.js";

function formatPreview(plan: StackPlan): string {
  const lines = [
    pc.bold("Zealakit — Stack Preview"),
    "",
    `Workspace  ${plan.projectName}  (${plan.packageManager})`,
  ];
  for (const member of plan.members) {
    lines.push(
      `  apps/${member.spec.name}  ${member.plan.config.templateId}  [${member.plan.selectedIds.join(", ") || "defaults only"}]  ${member.plan.files.length} files`,
    );
  }
  lines.push(
    "  packages/contracts  shared types + typed client",
    "",
    `Workspace files: ${plan.rootFiles.join(", ")}`,
  );
  for (const warning of plan.warnings) lines.push(pc.yellow(`⚠ ${warning}`));
  for (const blocker of plan.blockers) lines.push(pc.red(blocker));
  lines.push(
    "",
    plan.blockers.length === 0
      ? "Ready to scaffold. No files were written."
      : "Cannot scaffold: fix the errors above.",
  );
  return lines.join("\n");
}

function installCommand(pm: PackageManager): string {
  return `${pm} install`;
}

/** `zealakit create <name> --stack web=next,api=hono -w web:mui,api:prisma` */
export async function runStackCreate(
  projectName: string | undefined,
  options: CliOptions,
): Promise<never> {
  const json = options.json === true;
  const usage = (reason: string): never =>
    failDiagnostic(
      {
        title: "Invalid usage",
        reason,
        resolution: "Run: zealakit create <name> --stack web=next,api=hono -w web:mui,api:prisma",
      },
      ExitCode.USAGE,
    );
  if (!projectName) usage("--stack needs a project name.");
  if (options.discover || options.template || options.preset) {
    usage("--stack cannot be combined with --discover, --template or --preset.");
  }
  if (!options.yes && !options.dryRun)
    usage("--stack is non-interactive: pass -y to create, or --dry-run to preview.");

  const recipes = (options.with ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const spec = parseStackSpec(options.stack ?? "", recipes);
  if (!spec.ok) {
    printValidationErrors(spec.errors);
    process.exit(ExitCode.VALIDATION);
  }

  let packageManager: PackageManager;
  if (options.pm !== undefined) {
    if (!isPackageManager(options.pm))
      usage(`Unknown package manager '${options.pm}' (use ${PACKAGE_MANAGERS.join(", ")}).`);
    packageManager = options.pm as PackageManager;
  } else {
    packageManager = detectPackageManager(process.env.npm_config_user_agent);
  }

  const plan = buildStackPlan(projectName as string, spec.members, {
    cwd: process.cwd(),
    packageManager,
  });
  const fail = (code: ExitCode, messages: string[]): never => {
    if (json) {
      printInfo(
        JSON.stringify(
          {
            ok: false,
            error: { code: code === ExitCode.USAGE ? "usage" : "validation", messages },
          },
          null,
          2,
        ),
      );
    } else {
      printValidationErrors(messages);
    }
    process.exit(code);
  };

  if (options.dryRun) {
    if (json) {
      printInfo(
        JSON.stringify(
          {
            ok: plan.blockers.length === 0,
            projectName: plan.projectName,
            packageManager,
            members: plan.members.map((member) => ({
              name: member.spec.name,
              template: member.plan.config.templateId,
              recipes: member.plan.config.recipeIds,
              files: member.plan.files.length,
            })),
            rootFiles: plan.rootFiles,
            blockers: plan.blockers,
            warnings: plan.warnings,
          },
          null,
          2,
        ),
      );
    } else {
      printInfo(formatPreview(plan));
    }
    process.exit(plan.blockers.length === 0 ? ExitCode.OK : ExitCode.VALIDATION);
  }

  if (plan.blockers.length > 0) fail(ExitCode.VALIDATION, plan.blockers);
  const overwrite = await resolveOverwritePolicy(plan.projectName, process.cwd(), {
    yes: true,
    force: options.force,
  });
  if (!overwrite.result.valid) fail(ExitCode.VALIDATION, overwrite.result.errors);

  let target: string;
  try {
    target = executeStackPlan(plan, { overwrite: overwrite.policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json)
      fail(error instanceof ScaffoldValidationError ? ExitCode.VALIDATION : ExitCode.INTERNAL, [
        message,
      ]);
    printError(message);
    process.exit(
      error instanceof ScaffoldValidationError ? ExitCode.VALIDATION : ExitCode.INTERNAL,
    );
  }

  const warnings: string[] = [...plan.warnings];
  let install: "skipped" | "ok" | "failed" = "skipped";
  if (options.install) {
    const run = spawnSync(packageManager, ["install"], {
      cwd: target,
      stdio: ["ignore", 2, 2],
      shell: process.platform === "win32",
    });
    install = run.status === 0 ? "ok" : "failed";
    if (install === "failed")
      warnings.push(
        `Install failed; run \`${installCommand(packageManager)}\` in the workspace root.`,
      );
  }
  let git: "ok" | "skipped" | "failed" = "skipped";
  if (options.git) {
    const result = initGitRepository(target);
    git = result.git;
    if (git !== "ok") warnings.push(`git: ${result.message ?? git}`);
  }
  const nextSteps = [
    `cd ${path.relative(process.cwd(), target) || projectName}`,
    ...(install === "ok" ? [] : [installCommand(packageManager)]),
  ];

  if (json) {
    printInfo(
      JSON.stringify(
        {
          ok: true,
          outputDirectory: target,
          packageManager,
          stack: Object.fromEntries(
            plan.members.map((member) => [
              member.spec.name,
              {
                dir: member.dir,
                template: member.plan.config.templateId,
                recipes: member.plan.config.recipeIds,
              },
            ]),
          ),
          warnings,
          postGenerate: { install, git },
          nextSteps,
        },
        null,
        2,
      ),
    );
  } else {
    printInfo("");
    printInfo(
      `${pc.green("✔")} Stack ${pc.cyan(plan.projectName)} created: ${plan.members.map((member) => member.dir).join(", ")}`,
    );
    for (const warning of warnings) printWarning(`⚠ ${warning}`);
    printInfo("");
    printInfo(pc.bold("Next steps:"));
    for (const step of nextSteps) printInfo(`  ${pc.cyan(step)}`);
    printInfo("");
  }
  process.exit(ExitCode.OK);
}
