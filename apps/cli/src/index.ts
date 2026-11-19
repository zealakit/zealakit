import {
  CAPABILITIES,
  ECOSYSTEMS,
  ExitCode,
  getRecipeIds,
  getTemplateIds,
  PROJECT_TYPES,
  RECIPE_CATEGORIES,
  SCOPES,
  UI_FRAMEWORKS,
  validateProfiles,
} from "@zealakit/core/internal";
import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { registerPythonEcosystem } from "@zealakit/ecosystem-python";
import { Command, CommanderError } from "commander";
import { registerAddCommand } from "./add.js";
import { attachCreateOptions, runCreateAction } from "./create.js";
import { registerDiscoveryCommands } from "./discovery/commands.js";
import { runDoctor } from "./doctor.js";
import { type InfoCommandOptions, runInfo } from "./info.js";
import { readKitManifest } from "./manifest.js";
import { registerMcpCommand } from "./mcp.js";
import type { CliOptions } from "./options.js";
import { registerOutdatedCommand } from "./outdated.js";
import { failDiagnostic } from "./output.js";
import { registerPresetCommands } from "./preset-commands.js";
import { registerRecipeCommands } from "./recipe-commands.js";

registerNodeEcosystem();
registerPythonEcosystem();
registerGoEcosystem();

// Fail fast on authored Discovery metadata drift at application startup.
const profiles = validateProfiles();
if (!profiles.valid) {
  failDiagnostic(
    {
      title: "Invalid Discovery profiles",
      reason: profiles.errors.join("\n"),
      resolution:
        "Fix the `discovery` metadata on the template/recipe definitions in the ecosystem packages.",
    },
    ExitCode.INTERNAL,
  );
}

const program = new Command();

program
  .name("zealakit")
  .description(
    "Recipe-based project scaffolding. Start with `zealakit create` (supports --discover and --template).",
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
    "Machine-readable output: with --discover read one JSON request from stdin; otherwise non-interactive (needs -y, -w, --preset or --dry-run) and print one JSON result on stdout",
  )
  .action(async (projectName: string | undefined, options: CliOptions) => {
    await runCreateAction(projectName, options);
  });

// The root scaffold form (`zealakit [name] -t …`) was removed; `--info` stays as an alias.
program
  .option("--info", "Print kit metadata (alias of `zealakit info`)")
  .option("--json", "With --info: print only machine-readable JSON")
  .argument("[removed...]")
  .usage("[options] [command]")
  .allowUnknownOption()
  .action((args: string[], options: { info?: boolean; json?: boolean }) => {
    if (options.info) {
      process.exitCode = runInfo({ json: options.json === true });
      return;
    }
    if (args.length > 0 || process.argv.slice(2).length > 0) {
      failDiagnostic(
        {
          title: "Unknown command",
          reason: `'zealakit ${process.argv.slice(2).join(" ")}' is not a command. The root scaffold form \`zealakit [name] -t …\` was removed in this beta.`,
          resolution: "Run: zealakit create <project-name> [options]   (see `zealakit --help`)",
        },
        ExitCode.USAGE,
      );
    }
    program.help();
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
  .option("--capability <capability>", `Filter by Discovery capability: ${CAPABILITIES.join(", ")}`)
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
  .option("--cwd <dir>", "Project directory to check as well (default: current directory)")
  .action(async (options: { json?: boolean; minGoVersion?: string; cwd?: string }) => {
    await runDoctor({
      json: options.json === true,
      minGoVersion: options.minGoVersion,
      cwd: options.cwd,
    });
  });

registerDiscoveryCommands(program);
registerPresetCommands(program);
registerAddCommand(program);
registerOutdatedCommand(program);
registerRecipeCommands(program);
registerMcpCommand(program);

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
