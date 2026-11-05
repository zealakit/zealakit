import path from "node:path";
import {
  buildScaffoldPlan,
  type CliOptions,
  DEFAULT_TEMPLATE_ID,
  type DiscoverySessionDraft,
  ExitCode,
  fail,
  failDiagnostic,
  formatRecipeResolveError,
  getAllRecipeIds,
  getAllTemplateIds,
  getTemplate,
  getTemplateDevCommand,
  HYBRID_ORM_WARNING,
  hybridOrmSelections,
  planIsReady,
  printError,
  printInfo,
  printValidationErrors,
  recordDiscoverySession,
  resolveRecipeDependencies,
  type ScaffoldConfig,
  scaffoldProject,
  validateScaffoldInput,
  validateTemplate,
  withDefaultRecipes,
} from "@zealakit/core";
import type { Command } from "commander";
import pc from "picocolors";
import { formatScaffoldPreview } from "./preview.js";
import { runInteractivePrompts } from "./prompts.js";

type ResolvedCreateConfig = {
  config: ScaffoldConfig;
  discoveryFeedback: DiscoverySessionDraft | null;
};

function safeRecordDiscovery(
  draft: DiscoverySessionDraft | null,
  extras: {
    status: "completed" | "generation_failed";
    generationSucceeded: boolean;
  },
): void {
  if (!draft) return;
  try {
    recordDiscoverySession(draft, extras);
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
  const devCommand = template ? getTemplateDevCommand(template) : "npm run dev";

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
  if ((template?.ecosystem ?? "node") === "go") {
    printInfo(`  ${pc.cyan(devCommand)}`);
    printInfo(pc.dim("  Tip: run `zealakit doctor` if the Go toolchain is missing."));
  } else {
    printInfo(`  ${pc.cyan("npm install")}`);
    printInfo(`  ${pc.cyan(devCommand)}`);
  }
  printInfo("");
}

function formatSimpleInternal(message: string): string {
  return message.startsWith("✖") ? message : `✖ Error: ${message}`;
}

/** Shared create / root-scaffold action. */
export async function runCreateAction(
  projectName: string | undefined,
  options: CliOptions,
): Promise<void> {
  let discoveryFeedback: DiscoverySessionDraft | null = null;
  try {
    const resolved = await resolveScaffoldConfig(projectName, options);
    if (!resolved) {
      process.exit(ExitCode.OK);
    }
    discoveryFeedback = resolved.discoveryFeedback;

    const template = getTemplate(resolved.config.templateId);
    const requestedRecipeIds = resolved.config.recipeIds;
    const withDefaults = template
      ? withDefaultRecipes(template.scope, resolved.config.recipeIds)
      : resolved.config.recipeIds;
    const dependencyResolution = resolveRecipeDependencies(withDefaults);
    if (!dependencyResolution.ok) {
      safeRecordDiscovery(discoveryFeedback, {
        status: "generation_failed",
        generationSucceeded: false,
      });
      fail(formatRecipeResolveError(dependencyResolution.error), ExitCode.VALIDATION);
    }
    const config: ScaffoldConfig = {
      ...resolved.config,
      recipeIds: dependencyResolution.recipeIds,
    };

    if (options.dryRun) {
      if (!config.projectName) {
        failDiagnostic(
          {
            title: "Invalid usage",
            reason: "Flag --dry-run requires a project name.",
            resolution: "Run: zealakit create <project-name> --dry-run …",
          },
          ExitCode.USAGE,
        );
      }
      const plan = buildScaffoldPlan(config, process.cwd(), { requestedRecipeIds });
      printInfo(formatScaffoldPreview(plan));
      process.exit(planIsReady(plan) ? ExitCode.OK : ExitCode.VALIDATION);
    }

    const validation = await validateScaffoldInput(config, process.cwd(), { yes: options.yes });
    if (!validation.valid) {
      safeRecordDiscovery(discoveryFeedback, {
        status: "generation_failed",
        generationSucceeded: false,
      });
      printValidationErrors(validation.errors);
      process.exit(ExitCode.VALIDATION);
    }

    const targetDir = await scaffoldProject(config);
    safeRecordDiscovery(discoveryFeedback, {
      status: "completed",
      generationSucceeded: true,
    });
    printSuccess(targetDir, config);
  } catch (error) {
    safeRecordDiscovery(discoveryFeedback, {
      status: "generation_failed",
      generationSucceeded: false,
    });
    const message = error instanceof Error ? error.message : String(error);
    printError(message.includes("\n") ? message : formatSimpleInternal(message));
    process.exit(ExitCode.INTERNAL);
  }
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
    .option("-y, --yes", "Non-interactive mode (skip overwrite confirmation)")
    .option("--dry-run", "Resolve and validate without writing files")
    .option(
      "--discover",
      "Project Discovery: answer a few questions and get template/recipe recommendations",
    );
}
