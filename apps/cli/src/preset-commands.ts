import { ExitCode, isPackageManager } from "@zealakit/core/internal";
import type { Command } from "commander";
import { failDiagnostic, printInfo, printValidationErrors } from "./output.js";
import {
  formatPreset,
  listPresets,
  type Preset,
  removePreset,
  savePreset,
  userPresetsFile,
  validatePreset,
} from "./presets.js";

type SaveOptions = {
  template?: string;
  with?: string;
  pm?: string;
  install?: boolean;
  git?: boolean;
};

function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** `zealakit preset list|save|remove` — saved `create` configurations. */
export function registerPresetCommands(program: Command): void {
  const preset = program
    .command("preset")
    .description("Manage saved create presets (user-level plus ./zealakit.config.json)");

  preset
    .command("list")
    .description("List available presets")
    .option("--json", "Print machine-readable JSON")
    .action((options: { json?: boolean }) => {
      const entries = listPresets(process.cwd());
      if (options.json) {
        printInfo(JSON.stringify({ presets: entries }, null, 2));
      } else if (entries.length === 0) {
        printInfo(
          `No presets yet. Save one with \`zealakit preset save <name> -t <id> -w <recipes>\`.`,
        );
      } else {
        for (const entry of entries) printInfo(formatPreset(entry));
      }
    });

  preset
    .command("save <name>")
    .description(`Save a preset to ${userPresetsFile()}`)
    .option("-t, --template <template>", "Template id")
    .option("-w, --with <recipes>", "Comma-separated recipe ids")
    .option("--pm <manager>", "Package manager")
    .option("--install", "Install dependencies by default")
    .option("--no-install", "Do not install by default")
    .option("--git", "Initialize git by default")
    .option("--no-git", "Do not initialize git by default")
    .action((name: string, options: SaveOptions) => {
      const value: Preset = {
        ...(options.template ? { template: options.template } : {}),
        ...(options.with ? { recipes: parseList(options.with) } : {}),
        ...(options.pm && isPackageManager(options.pm) ? { packageManager: options.pm } : {}),
        ...(options.install !== undefined ? { install: options.install } : {}),
        ...(options.git !== undefined ? { git: options.git } : {}),
      };
      const candidate: unknown = options.pm ? { ...value, packageManager: options.pm } : value;
      const errors = validatePreset(name, candidate);
      if (errors.length > 0) {
        printValidationErrors(errors);
        process.exit(ExitCode.VALIDATION);
      }
      savePreset(name, value);
      printInfo(`Saved preset '${name}' to ${userPresetsFile()}`);
    });

  preset
    .command("remove <name>")
    .description("Remove a user-level preset")
    .action((name: string) => {
      if (!removePreset(name)) {
        failDiagnostic(
          {
            title: "Preset not found",
            reason: `No user-level preset named '${name}'.`,
            resolution: "Run `zealakit preset list`. Project presets live in zealakit.config.json.",
          },
          ExitCode.USAGE,
        );
      }
      printInfo(`Removed preset '${name}'.`);
    });
}
