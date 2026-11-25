import fs from "node:fs";
import path from "node:path";

import {
  buildScaffoldPlan,
  ExitCode,
  getAllTemplates,
  getRecipe,
  isRecipeCompatible,
  loadRecipeDirectory,
  planIsReady,
  RECIPE_DATA_SCHEMA_VERSION,
  registerRecipe,
  stagePlan,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import type { Command } from "commander";
import pc from "picocolors";

import { failDiagnostic, printInfo, printValidationErrors } from "./output.js";

type TemplateResult = { template: string; status: "ok" | "failed"; errors: string[] };

/** Stage the recipe on every compatible template; returns one result per template. */
function validateAgainstTemplates(recipeId: string): TemplateResult[] {
  const recipe = getRecipe(recipeId);
  if (!recipe) return [];
  const results: TemplateResult[] = [];
  for (const template of getAllTemplates()) {
    if (!isRecipeCompatible(recipe, template)) continue;
    const config = {
      projectName: "recipe-check",
      templateId: template.id,
      recipeIds: withDefaultRecipes(template.scope, [
        ...(recipe.requiresAnyOf?.[0] ? [recipe.requiresAnyOf[0]] : []),
        recipeId,
      ]),
    };
    const plan = buildScaffoldPlan(config, process.cwd(), { manifest: false });
    if (!planIsReady(plan)) {
      results.push({ template: template.id, status: "failed", errors: plan.blockers });
      continue;
    }
    try {
      stagePlan(plan).dispose();
      results.push({ template: template.id, status: "ok", errors: [] });
    } catch (error) {
      results.push({
        template: template.id,
        status: "failed",
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return results;
}

function initRecipe(name: string, options: { dir?: string; ecosystem?: string }): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    failDiagnostic(
      {
        title: "Invalid usage",
        reason: `Recipe name '${name}' must be lowercase letters, digits and dashes.`,
        resolution: "Run: zealakit recipe init my-recipe",
      },
      ExitCode.USAGE,
    );
  }
  const root = path.resolve(options.dir ?? name);
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    printValidationErrors([`'${root}' already exists and is not empty.`]);
    process.exit(ExitCode.VALIDATION);
  }
  const ecosystem = options.ecosystem === "go" ? "go" : "node";
  fs.mkdirSync(path.join(root, "shared", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "scaffold"), { recursive: true });
  fs.mkdirSync(path.join(root, ".agents", "skills", name), { recursive: true });

  const recipe = {
    $schema: "https://unpkg.com/zealakit/schema/recipe.schema.json",
    schemaVersion: RECIPE_DATA_SCHEMA_VERSION,
    id: name,
    name,
    hint: "Describe what this recipe adds",
    category: "utils",
    supportedScopes: ecosystem === "go" ? ["server", "infrastructure"] : ["client", "hybrid"],
    ecosystem,
    exclusive: false,
    ...(ecosystem === "go"
      ? { go: { modules: {} } }
      : { npm: { dependencies: {}, devDependencies: {}, scripts: {} } }),
  };
  fs.writeFileSync(path.join(root, "recipe.json"), `${JSON.stringify(recipe, null, 2)}\n`);
  fs.writeFileSync(
    path.join(root, "shared", "src", `${name}.txt`),
    `Files under shared/ are copied into every project that uses this recipe.\n`,
  );
  fs.writeFileSync(
    path.join(root, "scaffold", "agent-entry.md"),
    `- **${name}:** [.agents/skills/${name}/SKILL.md](.agents/skills/${name}/SKILL.md) — what this recipe adds\n`,
  );
  fs.writeFileSync(
    path.join(root, ".agents", "skills", name, "SKILL.md"),
    `---\nname: ${name}\ndescription: Explain when to use ${name} and its conventions.\n---\n\n# ${name}\n\nDescribe the conventions an AI agent should follow.\n`,
  );
  printInfo(`${pc.green("✔")} Created recipe '${name}' in ${root}`);
  printInfo(
    `Next: edit recipe.json, then \`zealakit recipe validate ${path.relative(process.cwd(), root) || "."}\``,
  );
}

function validateRecipe(dir: string, options: { json?: boolean }): void {
  const loaded = loadRecipeDirectory(path.resolve(dir), { source: path.resolve(dir) });
  if (!loaded.ok) {
    if (options.json) printInfo(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
    else printValidationErrors(loaded.errors);
    process.exit(ExitCode.VALIDATION);
  }
  const existing = getRecipe(loaded.recipe.id);
  if (existing && !existing.external) {
    const message = `Recipe id '${loaded.recipe.id}' collides with a built-in recipe.`;
    if (options.json) printInfo(JSON.stringify({ ok: false, errors: [message] }, null, 2));
    else printValidationErrors([message]);
    process.exit(ExitCode.VALIDATION);
  }
  registerRecipe(loaded.recipe);

  const results = validateAgainstTemplates(loaded.recipe.id);
  const failed = results.filter((result) => result.status === "failed");
  const ok = results.length > 0 && failed.length === 0;
  if (options.json) {
    printInfo(JSON.stringify({ ok, recipe: loaded.recipe.id, templates: results }, null, 2));
  } else {
    printInfo(
      `Recipe ${pc.cyan(loaded.recipe.id)} is valid data. Checked against ${results.length} compatible template(s):`,
    );
    for (const result of results) {
      printInfo(`  ${result.status === "ok" ? pc.green("✔") : pc.red("✖")} ${result.template}`);
      for (const error of result.errors) printInfo(pc.dim(`      ${error.split("\n")[0]}`));
    }
    if (results.length === 0) {
      printInfo(
        pc.yellow(
          "No template is compatible with this recipe (check supportedScopes, uiFrameworks and overlays).",
        ),
      );
    }
  }
  process.exit(ok ? ExitCode.OK : ExitCode.VALIDATION);
}

/** `zealakit recipe init|validate` — author external (data-only) recipes. */
export function registerRecipeCommands(program: Command): void {
  const recipe = program
    .command("recipe")
    .description("Author external recipes (data-only folders with recipe.json)");

  recipe
    .command("init <name>")
    .description("Create a recipe folder with recipe.json, shared/, scaffold/ and an agent skill")
    .option("--dir <dir>", "Target directory (default: ./<name>)")
    .option("--ecosystem <ecosystem>", "node (default) or go")
    .action((name: string, options: { dir?: string; ecosystem?: string }) =>
      initRecipe(name, options),
    );

  recipe
    .command("validate <dir>")
    .description(
      "Check a recipe folder: schema, no symlinks/code, and staging against every compatible template",
    )
    .option("--json", "Machine-readable output")
    .action((dir: string, options: { json?: boolean }) => validateRecipe(dir, options));
}
