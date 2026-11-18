import path from "node:path";
import { confirm, isCancel, text } from "@clack/prompts";
import {
  buildScaffoldPlan,
  DEFAULT_TEMPLATE_ID,
  type DiscoverySessionDraft,
  detectPackageManager,
  ExitCode,
  executeScaffoldPlan,
  getAllRecipeIds,
  getAllTemplateIds,
  getManifestAdapterForConfig,
  getTemplate,
  HYBRID_ORM_WARNING,
  hybridOrmSelections,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  type PostGenerateResult,
  planIsReady,
  recordDiscoverySession,
  type ScaffoldConfig,
  type ScaffoldPlan,
  ScaffoldValidationError,
  validateTemplate,
} from "@zealakit/core/internal";
import type { Command } from "commander";
import pc from "picocolors";
import { runDiscoveryQuery } from "./discovery/query.js";
import type { CliOptions } from "./options.js";
import {
  failDiagnostic,
  printError,
  printInfo,
  printValidationErrors,
  printWarning,
} from "./output.js";
import { type GitResult, initGitRepository } from "./post-generate.js";
import { getPreset, loadConfigDefaults, savePreset, validatePreset } from "./presets.js";
import { formatScaffoldPreview } from "./preview.js";
import { runInteractivePrompts } from "./prompts.js";
import { resolveOverwritePolicy } from "./target-dir.js";

type ResolvedCreateConfig = {
  config: ScaffoldConfig;
  /** True when the user answered prompts (so we may also ask about install/git). */
  interactive: boolean;
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
  if (projectName && (recipesFlag || options.yes || options.dryRun || options.preset)) {
    return {
      interactive: false,
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
    interactive: true,
    config: prompted.config,
    discoveryFeedback: prompted.feedback,
  };
}

type PostGenerateSummary = {
  packageManager: PackageManager;
  install: PostGenerateResult["install"];
  git: GitResult["git"];
  warnings: string[];
};

function nextStepLines(
  plan: ScaffoldPlan,
  targetDir: string,
  post: PostGenerateSummary,
): { commands: string[]; tip?: string } {
  const relativePath = path.relative(process.cwd(), targetDir) || plan.config.projectName;
  const steps = getManifestAdapterForConfig(plan.config).nextSteps(plan.config, {
    packageManager: post.packageManager,
    installed: post.install === "ok",
  });
  return { commands: [`cd ${relativePath}`, ...steps.commands], tip: steps.tip };
}

function printSuccess(plan: ScaffoldPlan, targetDir: string, post: PostGenerateSummary): void {
  const config = plan.config;
  const template = getTemplate(config.templateId);
  const steps = nextStepLines(plan, targetDir, post);

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
  for (const warning of post.warnings) {
    printWarning(`⚠ ${warning}`);
  }
  printInfo("");
  printInfo(pc.bold("Next steps:"));
  const [cd, ...rest] = steps.commands;
  printInfo(`  ${pc.cyan("cd")} ${(cd ?? "").replace(/^cd /, "")}`);
  for (const command of rest) {
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

function usageError(reason: string, resolution: string): never {
  return failDiagnostic({ title: "Invalid usage", reason, resolution }, ExitCode.USAGE);
}

function assertJsonUsage(projectName: string | undefined, options: CliOptions): void {
  if (options.discover) {
    if (projectName || options.template || options.with || options.yes || options.dryRun) {
      usageError(
        "JSON Discovery mode reads the whole request from stdin and cannot be combined with a project name, -t, -w, -y, or --dry-run.",
        'Put "project.name", "selection", and "confirmation" in the JSON request instead.',
      );
    }
    return;
  }
  if (!projectName || !(options.yes || options.with || options.preset || options.dryRun)) {
    usageError(
      "Flag --json is non-interactive: it needs a project name plus -y, -w, --preset or --dry-run.",
      "Run: zealakit create <project-name> -t <template> -w <recipes> --json",
    );
  }
}

/** Fold a saved preset under explicit flags (flags win). */
function applyPreset(base: CliOptions): CliOptions {
  // Config `defaults` sit below presets and explicit flags.
  let options = base;
  try {
    const defaults = loadConfigDefaults(process.cwd(), process.env, base.config);
    options = {
      ...base,
      pm: base.pm ?? defaults.packageManager,
      install: base.install ?? defaults.install,
      git: base.git ?? defaults.git,
    };
  } catch (error) {
    printValidationErrors([error instanceof Error ? error.message : String(error)]);
    process.exit(ExitCode.VALIDATION);
  }
  if (!options.preset) return options;
  let entry: ReturnType<typeof getPreset>;
  try {
    entry = getPreset(options.preset, process.cwd(), process.env, options.config);
  } catch (error) {
    printValidationErrors([error instanceof Error ? error.message : String(error)]);
    process.exit(ExitCode.VALIDATION);
  }
  if (!entry) {
    usageError(
      `Preset '${options.preset}' was not found.`,
      "Run `zealakit preset list` to see available presets.",
    );
  }
  const errors = validatePreset(entry.name, entry.preset);
  if (errors.length > 0) {
    printValidationErrors(errors);
    process.exit(ExitCode.VALIDATION);
  }
  const preset = entry.preset;
  return {
    ...options,
    template: options.template ?? preset.template,
    with: options.with ?? preset.recipes?.join(","),
    pm: options.pm ?? preset.packageManager,
    install: options.install ?? preset.install,
    git: options.git ?? preset.git,
  };
}

async function askYesNo(message: string): Promise<boolean> {
  const answer = await confirm({ message, initialValue: true });
  if (isCancel(answer)) {
    process.exit(ExitCode.OK);
  }
  return answer;
}

type CreateResult =
  | { kind: "cancelled" }
  | { kind: "dry-run"; plan: ScaffoldPlan }
  | { kind: "failed"; code: ExitCode; messages: string[] }
  | {
      kind: "created";
      plan: ScaffoldPlan;
      targetDir: string;
      post: PostGenerateSummary;
      /** The user answered prompts (so offering to save a preset makes sense). */
      interactive: boolean;
    };

function failed(code: ExitCode, messages: string[]): CreateResult {
  return { kind: "failed", code, messages };
}

/** Runs the create flow and reports what happened (no `process.exit` inside). */
async function runCreate(
  projectName: string | undefined,
  options: CliOptions,
  session: { feedback: DiscoverySessionDraft | null },
): Promise<CreateResult> {
  const resolved = await resolveScaffoldConfig(projectName, options);
  if (!resolved) {
    return { kind: "cancelled" };
  }
  session.feedback = resolved.discoveryFeedback;

  if (options.dryRun && !resolved.config.projectName) {
    usageError(
      "Flag --dry-run requires a project name.",
      "Run: zealakit create <project-name> --dry-run …",
    );
  }

  let packageManager: PackageManager;
  if (options.pm !== undefined) {
    if (!isPackageManager(options.pm)) {
      usageError(
        `Unknown package manager '${options.pm}'.`,
        `Use one of: ${PACKAGE_MANAGERS.join(", ")}.`,
      );
    }
    packageManager = options.pm;
  } else {
    packageManager = detectPackageManager(process.env.npm_config_user_agent);
  }

  // One plan: defaults, id validation, dependency resolution and config
  // validation happen here, and the same plan is previewed or executed.
  const plan = buildScaffoldPlan({ ...resolved.config, packageManager }, process.cwd(), {
    requestedRecipeIds: resolved.config.recipeIds,
    manifest: options.manifest !== false,
  });

  if (options.dryRun) {
    return { kind: "dry-run", plan };
  }

  if (!planIsReady(plan)) {
    printValidationErrors(plan.blockers);
    return failed(ExitCode.VALIDATION, plan.blockers);
  }

  const overwrite = await resolveOverwritePolicy(plan.config.projectName, process.cwd(), options);
  if (!overwrite.result.valid) {
    printValidationErrors(overwrite.result.errors);
    return failed(ExitCode.VALIDATION, overwrite.result.errors);
  }

  // Ask only when the user answered prompts; scripted runs default to "no".
  const install =
    options.install ?? (resolved.interactive ? await askYesNo("Install dependencies?") : false);
  const useGit =
    options.git ?? (resolved.interactive ? await askYesNo("Initialize a git repository?") : false);

  const targetDir = await executeScaffoldPlan(plan, { overwrite: overwrite.policy });

  // The project is committed on disk: nothing below may fail the scaffold.
  const warnings: string[] = [];
  let installResult: PostGenerateResult = { install: "skipped" };
  const adapter = getManifestAdapterForConfig(plan.config);
  if (adapter.postGenerate) {
    try {
      installResult = await adapter.postGenerate(targetDir, plan.config, {
        packageManager,
        install,
      });
    } catch (error) {
      installResult = {
        install: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  if (installResult.install === "failed") {
    warnings.push(
      `Install failed (${installResult.message ?? "unknown error"}). The project was created; run the install command below to retry.`,
    );
  }

  let gitResult: GitResult = { git: "skipped" };
  if (useGit) {
    gitResult = initGitRepository(targetDir);
    if (gitResult.git !== "ok") {
      warnings.push(`git: ${gitResult.message ?? gitResult.git}`);
    }
  }

  return {
    kind: "created",
    interactive: resolved.interactive,
    plan,
    targetDir,
    post: {
      packageManager,
      install: installResult.install,
      git: gitResult.git,
      warnings,
    },
  };
}

const EXIT_CODE_NAMES: Record<number, string> = {
  [ExitCode.USAGE]: "usage",
  [ExitCode.VALIDATION]: "validation",
  [ExitCode.INTERNAL]: "internal",
};

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** Shared create / root-scaffold action. */
export async function runCreateAction(
  projectName: string | undefined,
  rawOptions: CliOptions,
): Promise<void> {
  const json = rawOptions.json === true;
  if (json) {
    assertJsonUsage(projectName, rawOptions);
    if (rawOptions.discover) {
      process.exit(await runDiscoveryQuery());
    }
  }

  const presetOptions = applyPreset(rawOptions);
  // JSON mode never prompts: a non-empty target is refused unless --force.
  const options: CliOptions = json ? { ...presetOptions, yes: true } : presetOptions;

  const session: { feedback: DiscoverySessionDraft | null } = { feedback: null };
  let result: CreateResult;
  try {
    result = await runCreate(projectName, options, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ScaffoldValidationError) {
      // Validation messages are already actionable; keep them verbatim.
      printError(message);
    } else {
      printError(message.includes("\n") ? message : formatSimpleInternal(message));
    }
    result = failed(exitCodeForError(error), [message]);
  }

  let code: ExitCode = ExitCode.OK;
  switch (result.kind) {
    case "cancelled":
      break;
    case "failed":
      code = result.code;
      if (json) {
        printJson({
          ok: false,
          error: { code: EXIT_CODE_NAMES[code] ?? "internal", messages: result.messages },
        });
      }
      break;
    case "dry-run": {
      code = planIsReady(result.plan) ? ExitCode.OK : ExitCode.VALIDATION;
      if (json) {
        printJson({ ok: code === ExitCode.OK, ...result.plan });
      } else {
        printInfo(formatScaffoldPreview(result.plan));
      }
      break;
    }
    case "created": {
      const { plan, targetDir, post } = result;
      let presetName = options.savePreset;
      if (!presetName && result.interactive && !json && !options.yes && process.stdin.isTTY) {
        // Off by default: only an explicit "yes" and a name saves anything.
        const wants = await confirm({
          message: "Save these choices as a preset?",
          initialValue: false,
        });
        if (wants === true) {
          const name = await text({
            message: "Preset name:",
            validate: (value) =>
              value && /^[a-z0-9][a-z0-9._-]*$/i.test(value)
                ? undefined
                : "Use letters, digits, '.', '_' or '-'.",
          });
          if (typeof name === "string") presetName = name;
        }
      }
      if (presetName) {
        try {
          savePreset(presetName, {
            template: plan.config.templateId,
            recipes: plan.selectedIds,
            packageManager: post.packageManager,
          });
          post.warnings.push(`Saved preset '${presetName}'.`);
        } catch (error) {
          post.warnings.push(
            `Could not save preset: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (json) {
        printJson({
          ok: true,
          outputDirectory: targetDir,
          template: plan.config.templateId,
          recipes: plan.config.recipeIds,
          requestedRecipes: plan.selectedIds,
          files: plan.files.length,
          warnings: [...plan.warnings, ...post.warnings],
          postGenerate: {
            packageManager: post.packageManager,
            install: post.install,
            git: post.git,
          },
          nextSteps: nextStepLines(plan, targetDir, post).commands,
        });
      } else {
        printSuccess(plan, targetDir, post);
      }
      break;
    }
  }

  // Dry-run and cancelled flows have no generation to report on.
  if (result.kind === "created" || result.kind === "failed") {
    recordDiscoveryOutcome(session.feedback, result.kind === "created");
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
      "--pm <manager>",
      `Package manager for install and next steps: ${PACKAGE_MANAGERS.join(", ")} (default: detected)`,
    )
    .option("--install", "Install dependencies after generating (go mod tidy for Go)")
    .option("--no-install", "Do not install dependencies")
    .option("--git", "Run git init and make an initial commit")
    .option("--no-git", "Do not initialize a git repository")
    .option("--no-manifest", "Do not write zealakit.json into the project")
    .option(
      "--config <file>",
      "Config file with `defaults` and `presets` (highest precedence over project/user config)",
    )
    .option(
      "--preset <name>",
      "Apply a saved preset (see `zealakit preset list`); flags override it",
    )
    .option("--save-preset <name>", "Save the chosen template and recipes as a user preset")
    .option(
      "--discover",
      "Project Discovery: answer a few questions and get template/recipe recommendations",
    );
}
