import path from "node:path";
import {
  buildScaffoldPlan,
  type CliOptions,
  DEFAULT_TEMPLATE_ID,
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
  resolveRecipeDependencies,
  type ScaffoldConfig,
  scaffoldProject,
  validateScaffoldInput,
  validateTemplate,
  withDefaultRecipes,
} from "@zealakit/core";
import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { Command } from "commander";
import pc from "picocolors";
import { runDoctor } from "./doctor.js";
import { printKitInfo } from "./info.js";
import { readKitManifest } from "./manifest.js";
import { formatScaffoldPreview } from "./preview.js";
import { runInteractivePrompts } from "./prompts.js";

registerNodeEcosystem();
registerGoEcosystem();

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
async function resolveScaffoldConfig(
  projectName: string | undefined,
  options: CliOptions,
): Promise<ScaffoldConfig | null> {
  if (options.yes && !projectName) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: "Flag -y requires a project name.",
        resolution: "Run: zealakit <project-name> -y …",
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
      projectName,
      templateId: options.template ?? DEFAULT_TEMPLATE_ID,
      recipeIds: parseRecipeList(recipesFlag ?? ""),
    };
  }

  return runInteractivePrompts({ projectName, templateId: options.template });
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

const program = new Command();

program
  .name("zealakit")
  .description("Recipe-based scaffolding CLI for TypeScript project templates")
  .version(readKitManifest().version)
  .enablePositionalOptions()
  .argument("[project-name]", "Project name (npm naming rules)")
  .option(
    "-t, --template <template>",
    `Base template (default: ${DEFAULT_TEMPLATE_ID}). Available: ${getAllTemplateIds().join(", ")}`,
  )
  .option(
    "-w, --with <recipes>",
    `Recipes to apply, comma-separated (e.g. biome). Available: ${getAllRecipeIds().join(", ")}`,
  )
  .option("-y, --yes", "Non-interactive mode (skip overwrite confirmation)")
  .option("--dry-run", "Resolve and validate without writing files")
  .option("--info", "Print kit metadata (alias of `zealakit info`)")
  .option("--json", "With --info: print only machine-readable JSON")
  .action(async (projectName: string | undefined, options: CliOptions) => {
    if (options.info) {
      printKitInfo({ json: options.json === true });
      return;
    }
    if (options.json) {
      failDiagnostic(
        {
          title: "Invalid usage",
          reason: "Flag --json requires --info.",
          resolution: "Use `zealakit info --json` or `zealakit --info --json`.",
        },
        ExitCode.USAGE,
      );
    }

    try {
      const resolved = await resolveScaffoldConfig(projectName, options);
      if (!resolved) {
        process.exit(ExitCode.OK);
      }

      const template = getTemplate(resolved.templateId);
      const requestedRecipeIds = resolved.recipeIds;
      const withDefaults = template
        ? withDefaultRecipes(template.scope, resolved.recipeIds)
        : resolved.recipeIds;
      const dependencyResolution = resolveRecipeDependencies(withDefaults);
      if (!dependencyResolution.ok) {
        fail(formatRecipeResolveError(dependencyResolution.error), ExitCode.VALIDATION);
      }
      const config: ScaffoldConfig = {
        ...resolved,
        recipeIds: dependencyResolution.recipeIds,
      };

      if (options.dryRun) {
        if (!config.projectName) {
          failDiagnostic(
            {
              title: "Invalid usage",
              reason: "Flag --dry-run requires a project name.",
              resolution: "Run: zealakit <project-name> --dry-run …",
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
        printValidationErrors(validation.errors);
        process.exit(ExitCode.VALIDATION);
      }

      const targetDir = await scaffoldProject(config);
      printSuccess(targetDir, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printError(message.includes("\n") ? message : formatSimpleInternal(message));
      process.exit(ExitCode.INTERNAL);
    }
  });

function formatSimpleInternal(message: string): string {
  return message.startsWith("✖") ? message : `✖ Error: ${message}`;
}

program
  .command("info")
  .description("Print kit metadata: templates, categories, recipes, compatibility rules")
  .option("--json", "Print only machine-readable JSON (stdout contains nothing else)")
  .action((options: { json?: boolean }) => {
    printKitInfo({ json: options.json === true });
  });

program
  .command("doctor")
  .description("Check Zealakit runtime and optional Go toolchain availability")
  .option("--json", "Print only machine-readable JSON (stdout contains nothing else)")
  .option(
    "--min-go-version <version>",
    "Require Go >= version (e.g. 1.22.0); missing/incompatible then exits non-zero",
  )
  .action(async (options: { json?: boolean; minGoVersion?: string }) => {
    await runDoctor({
      json: options.json === true,
      minGoVersion: options.minGoVersion,
    });
  });

program.parse(process.argv);
