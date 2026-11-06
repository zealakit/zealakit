import {
  type CliOptions,
  ECOSYSTEMS,
  ExitCode,
  failDiagnostic,
  getRecipeIds,
  getTemplateIds,
  PROJECT_TYPES,
  RECIPE_CATEGORIES,
  SCOPES,
  UI_FRAMEWORKS,
} from "@zealakit/core";
import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { Command, CommanderError } from "commander";
import { attachCreateOptions, runCreateAction } from "./create.js";
import { registerDiscoveryCommands } from "./discovery/commands.js";
import { runDoctor } from "./doctor.js";
import { type InfoCommandOptions, runInfo } from "./info.js";
import { readKitManifest } from "./manifest.js";

registerNodeEcosystem();
registerGoEcosystem();

const program = new Command();

program
  .name("zealakit")
  .description(
    "Recipe-based project scaffolding. Prefer `zealakit create` (supports --discover and --template).",
  )
  .version(readKitManifest().version)
  .enablePositionalOptions();

// Primary documented entry: `zealakit create [--discover | --template …]`
attachCreateOptions(
  program
    .command("create")
    .description(
      "Create a new project. Modes: interactive prompts, --discover (recommendations), or --template <id>.",
    ),
)
  .option(
    "--json",
    "With --discover: read one Discovery/scaffold JSON request from stdin and print one JSON response",
  )
  .action(async (projectName: string | undefined, options: CliOptions) => {
    await runCreateAction(projectName, options);
  });

// Backward-compatible root scaffold (`zealakit [name] -t …`) plus --info alias.
attachCreateOptions(program)
  .option("--info", "Print kit metadata (alias of `zealakit info`)")
  .option("--json", "With --info: print only machine-readable JSON")
  .action(async (projectName: string | undefined, options: CliOptions) => {
    if (options.info) {
      // Filters live on `zealakit info`; the root alias stays flag-compatible.
      process.exitCode = runInfo({ json: options.json === true });
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

    await runCreateAction(projectName, options);
  });

program
  .command("info")
  .description("Print kit metadata: templates, recipes, ecosystems, categories, Discovery profiles")
  .option("--json", "Print only machine-readable JSON (stdout contains nothing else)")
  .option("--ecosystem <ecosystem>", `Filter by ecosystem: ${ECOSYSTEMS.join(", ")}`)
  .option("--scope <scope>", `Filter by template scope: ${SCOPES.join(", ")}`)
  .option(
    "--project-type <projectType>",
    `Filter by Discovery project type: ${PROJECT_TYPES.join(", ")}`,
  )
  .option("--ui-framework <uiFramework>", `Filter by UI framework: ${UI_FRAMEWORKS.join(", ")}`)
  .option("--template <templateId>", `Filter by template id: ${getTemplateIds().join(", ")}`)
  .option("--recipe <recipeId>", `Filter by recipe id: ${getRecipeIds().join(", ")}`)
  .option("--category <category>", `Filter by recipe category: ${RECIPE_CATEGORIES.join(", ")}`)
  .option(
    "--discover",
    "Include Discovery profiles and keep only Discovery-eligible entries (no questionnaire, no scoring)",
  )
  .action((options: InfoCommandOptions) => {
    process.exitCode = runInfo(options);
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

registerDiscoveryCommands(program);

/** Commander exits directly per command; override nested ones so parse errors map to usage. */
function overrideCommanderExit(command: Command): void {
  command.exitOverride();
  for (const subcommand of command.commands) {
    overrideCommanderExit(subcommand);
  }
}

overrideCommanderExit(program);

try {
  program.parse(process.argv);
} catch (error) {
  // Commander exits 1 for parse errors by default; the CLI convention is 2.
  if (error instanceof CommanderError) {
    process.exit(error.exitCode === 0 ? ExitCode.OK : ExitCode.USAGE);
  }
  throw error;
}
