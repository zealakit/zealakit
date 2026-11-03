import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { printKitInfo } from "./info.js";
import { readKitManifest } from "./manifest.js";
import { runInteractivePrompts } from "./prompts.js";
import {
  DEFAULT_TEMPLATE_ID,
  getAllRecipeIds,
  getAllTemplateIds,
  getTemplate,
  getTemplateDevCommand,
  withDefaultRecipes,
} from "./registry/index.js";
import { scaffoldProject } from "./scaffold/index.js";
import type { CliOptions, ScaffoldConfig } from "./types.js";
import {
  printValidationErrors,
  validateScaffoldInput,
  validateTemplate,
} from "./validation/index.js";

function fail(message: string): never {
  console.error(pc.red(message));
  process.exit(1);
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
async function resolveScaffoldConfig(
  projectName: string | undefined,
  options: CliOptions,
): Promise<ScaffoldConfig | null> {
  if (options.yes && !projectName) {
    fail("✖ Flag -y requires a project name.");
  }

  if (options.template) {
    const templateCheck = validateTemplate(options.template);
    if (!templateCheck.valid) {
      fail(`✖ ${templateCheck.errors.join("\n")}`);
    }
  }

  const recipesFlag = options.with?.trim();
  if (projectName && (recipesFlag || options.yes)) {
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

  console.log();
  console.log(`${pc.green("✔")} Project ${pc.cyan(config.projectName)} created successfully!`);
  console.log();
  console.log(pc.bold("Next steps:"));
  console.log(`  ${pc.cyan("cd")} ${relativePath}`);
  console.log(`  ${pc.cyan("npm install")}`);
  console.log(`  ${pc.cyan(devCommand)}`);
  console.log();
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
  .option("--info", "Print kit metadata (alias of `zealakit info`)")
  .option("--json", "With --info: print only machine-readable JSON")
  .action(async (projectName: string | undefined, options: CliOptions) => {
    if (options.info) {
      printKitInfo({ json: options.json === true });
      return;
    }
    if (options.json) {
      fail("✖ Flag --json requires --info (or use `zealakit info --json`).");
    }

    try {
      const resolved = await resolveScaffoldConfig(projectName, options);
      if (!resolved) {
        process.exit(0);
      }

      const template = getTemplate(resolved.templateId);
      const config: ScaffoldConfig = {
        ...resolved,
        recipeIds: template
          ? withDefaultRecipes(template.scope, resolved.recipeIds)
          : resolved.recipeIds,
      };

      const validation = await validateScaffoldInput(config, process.cwd(), { yes: options.yes });
      if (!validation.valid) {
        printValidationErrors(validation.errors);
        process.exit(1);
      }

      const targetDir = await scaffoldProject(config);
      printSuccess(targetDir, config);
    } catch (error) {
      fail(`✖ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command("info")
  .description("Print kit metadata: templates, categories, recipes, compatibility rules")
  .option("--json", "Print only machine-readable JSON (stdout contains nothing else)")
  .action((options: { json?: boolean }) => {
    printKitInfo({ json: options.json === true });
  });

program.parse(process.argv);
