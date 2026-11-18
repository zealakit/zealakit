import path from "node:path";
import {
  buildScaffoldPlan,
  DEFAULT_TEMPLATE_ID,
  type DiscoverySessionDraft,
  ExitCode,
  executeScaffoldPlan,
  getAllRecipeIds,
  getAllTemplateIds,
  getManifestAdapterForConfig,
  getTemplate,
  HYBRID_ORM_WARNING,
  hybridOrmSelections,
  planIsReady,
  recordDiscoverySession,
  type ScaffoldConfig,
  ScaffoldValidationError,
  validateTemplate,
} from "@zealakit/core/internal";
import type { Command } from "commander";
import pc from "picocolors";
import { runDiscoveryQuery } from "./discovery/query.js";
import type { CliOptions } from "./options.js";
import { failDiagnostic, printError, printInfo, printValidationErrors } from "./output.js";
import { formatScaffoldPreview } from "./preview.js";
import { runInteractivePrompts } from "./prompts.js";
import { resolveOverwritePolicy } from "./target-dir.js";

type ResolvedCreateConfig = {
  config: ScaffoldConfig;
  discoveryFeedback: DiscoverySessionDraft | null;
};

function recordDiscoveryOutcome(draft: DiscoverySessionDraft | null, succeeded: boolean): void {
  if (!draft) return;
  try {
    recordDiscoverySession(draft, {
      status: succeeded ? "completed" : "generation_failed",
      generationSucceeded: succeeded,
    });
  } catch {
    // Feedback must never interrupt scaffolding.
  }
}

function parseRecipeList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Non-interactive when a project name is given together with `-w` or `-y`;
 * otherwise prompts for whatever is missing (keeping `-t` if provided).
 */
export async function resolveScaffoldConfig(
  projectName: string | undefined,
  options: CliOptions,
): Promise<ResolvedCreateConfig | null> {
  if (options.yes && !projectName) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: "Flag -y requires a project name.",
        resolution: "Run: zealakit create <project-name> -y …",
      },
      ExitCode.USAGE,
    );
  }

  if (options.discover && (options.yes || options.with || options.dryRun)) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason:
          "Project Discovery is interactive and cannot be combined with -y, -w, or --dry-run.",
        resolution: "Run: zealakit create --discover",
      },
      ExitCode.USAGE,
    );
  }

  if (options.discover && options.template) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: "Use either --discover or --template, not both.",
        resolution: "Run: zealakit create --discover   or   zealakit create --template <id>",
      },
      ExitCode.USAGE,
    );
  }

  if (options.template) {
    const templateCheck = validateTemplate(options.template);
    if (!templateCheck.valid) {
      printValidationErrors(templateCheck.errors);
      process.exit(ExitCode.VALIDATION);
    }
  }

  const recipesFlag = options.with?.trim();
  if (projectName && (recipesFlag || options.yes || options.dryRun)) {
    return {
      config: {
        projectName,
        templateId: options.template ?? DEFAULT_TEMPLATE_ID,
        recipeIds: parseRecipeList(recipesFlag ?? ""),
      },
      discoveryFeedback: null,
    };
  }

  const prompted = await runInteractivePrompts({
    projectName,
    templateId: options.template,
    discover: options.discover === true,
  });
  if (!prompted.config) {
    return null;
  }
  return {
    config: prompted.config,
    discoveryFeedback: prompted.feedback,
  };
}

function printSuccess(targetDir: string, config: ScaffoldConfig): void {
  const relativePath = path.relative(process.cwd(), targetDir) || config.projectName;
  const template = getTemplate(config.templateId);
  const steps = getManifestAdapterForConfig(config).nextSteps(config);

  printInfo("");
  printInfo(`${pc.green("✔")} Project ${pc.cyan(config.projectName)} created successfully!`);
  if (template) {
    const ormIds = hybridOrmSelections(template, config.recipeIds);
    if (ormIds.length > 0) {
      printInfo("");
      printInfo(pc.yellow(`⚠ ${HYBRID_ORM_WARNING}`));
      printInfo(pc.dim(`  Selected ORM: ${ormIds.join(", ")}`));
    }
  }
  printInfo("");
  printInfo(pc.bold("Next steps:"));
  printInfo(`  ${pc.cyan("cd")} ${relativePath}`);
  for (const command of steps.commands) {
    printInfo(`  ${pc.cyan(command)}`);
  }
  if (steps.tip) {
    printInfo(pc.dim(`  Tip: ${steps.tip}`));
  }
  printInfo("");
}

function formatSimpleInternal(message: string): string {
  return message.startsWith("✖") ? message : `✖ Error: ${message}`;
}

/**
 * Map a thrown create/scaffold error to the documented CLI exit codes.
 * Validation errors keep their identity from `@zealakit/core`; filesystem,
 * commit, and programming failures stay internal.
 */
export function exitCodeForError(error: unknown): ExitCode {
  return error instanceof ScaffoldValidationError ? ExitCode.VALIDATION : ExitCode.INTERNAL;
}

function assertJsonDiscoveryUsage(projectName: string | undefined, options: CliOptions): void {
  if (!options.discover) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: "Flag --json requires --discover.",
        resolution: "Run: zealakit create --discover --json < request.json",
      },
      ExitCode.USAGE,
    );
  }
  if (projectName || options.template || options.with || options.yes || options.dryRun) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason:
          "JSON Discovery mode reads the whole request from stdin and cannot be combined with a project name, -t, -w, -y, or --dry-run.",
        resolution:
          'Put "project.name", "selection", and "confirmation" in the JSON request instead.',
      },
      ExitCode.USAGE,
    );
  }
}

/** Runs the create flow and returns the process exit code (no `process.exit` inside). */
async function runCreate(
  projectName: string | undefined,
  options: CliOptions,
  session: { feedback: DiscoverySessionDraft | null },
): Promise<ExitCode> {
  const resolved = await resolveScaffoldConfig(projectName, options);
  if (!resolved) {
    return ExitCode.OK;
  }
  session.feedback = resolved.discoveryFeedback;

  if (options.dryRun && !resolved.config.projectName) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: "Flag --dry-run requires a project name.",
        resolution: "Run: zealakit create <project-name> --dry-run …",
      },
      ExitCode.USAGE,
    );
  }

  // One plan: defaults, id validation, dependency resolution and config
  // validation happen here, and the same plan is previewed or executed.
  const plan = buildScaffoldPlan(resolved.config, process.cwd(), {
    requestedRecipeIds: resolved.config.recipeIds,
  });

  if (options.dryRun) {
    printInfo(formatScaffoldPreview(plan));
    return planIsReady(plan) ? ExitCode.OK : ExitCode.VALIDATION;
  }

  if (!planIsReady(plan)) {
    printValidationErrors(plan.blockers);
    return ExitCode.VALIDATION;
  }

  const overwrite = await resolveOverwritePolicy(plan.config.projectName, process.cwd(), options);
  if (!overwrite.result.valid) {
    printValidationErrors(overwrite.result.errors);
    return ExitCode.VALIDATION;
  }

  const targetDir = await executeScaffoldPlan(plan, { overwrite: overwrite.policy });
  printSuccess(targetDir, plan.config);
  return ExitCode.OK;
}

/** Shared create / root-scaffold action. */
export async function runCreateAction(
  projectName: string | undefined,
  options: CliOptions,
): Promise<void> {
  if (options.json) {
    assertJsonDiscoveryUsage(projectName, options);
    process.exit(await runDiscoveryQuery());
  }

  const session: { feedback: DiscoverySessionDraft | null } = { feedback: null };
  let code: ExitCode;
  try {
    code = await runCreate(projectName, options, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ScaffoldValidationError) {
      // Validation messages are already actionable; keep them verbatim.
      printError(message);
    } else {
      printError(message.includes("\n") ? message : formatSimpleInternal(message));
    }
    code = exitCodeForError(error);
  }
  // Dry-run and cancelled flows have no generation to report on.
  if (!options.dryRun) {
    recordDiscoveryOutcome(session.feedback, code === ExitCode.OK);
  }
  process.exit(code);
}

/** Attach shared create options to a Commander command. */
export function attachCreateOptions(command: Command): Command {
  return command
    .argument("[project-name]", "Project name (npm naming rules)")
    .option(
      "-t, --template <template>",
      `Choose a base template yourself (default: ${DEFAULT_TEMPLATE_ID}). Available: ${getAllTemplateIds().join(", ")}`,
    )
    .option(
      "-w, --with <recipes>",
      `Recipes to apply, comma-separated (e.g. biome). Available: ${getAllRecipeIds().join(", ")}`,
    )
    .option("-y, --yes", "Non-interactive: never prompt; refuses a non-empty target")
    .option("--force", "Overwrite a non-empty target directory without asking")
    .option("--dry-run", "Resolve and validate without writing files")
    .option(
      "--discover",
      "Project Discovery: answer a few questions and get template/recipe recommendations",
    );
}
