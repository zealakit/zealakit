import { type CliOptions, ExitCode, failDiagnostic } from "@zealakit/core";
import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { Command } from "commander";
import { attachCreateOptions, runCreateAction } from "./create.js";
import { registerDiscoveryCommands } from "./discovery/commands.js";
import { runDoctor } from "./doctor.js";
import { printKitInfo } from "./info.js";
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
).action(async (projectName: string | undefined, options: CliOptions) => {
  await runCreateAction(projectName, options);
});

// Backward-compatible root scaffold (`zealakit [name] -t …`) plus --info alias.
attachCreateOptions(program)
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

    await runCreateAction(projectName, options);
  });

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

registerDiscoveryCommands(program);

program.parse(process.argv);
