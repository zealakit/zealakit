import fs from "node:fs";
import path from "node:path";
import { getRecipe, getTemplate, getTemplateOverlayId } from "../registry/index.js";
import type { ScaffoldConfig } from "../types.js";
import { getRecipeAgentEntry } from "./agent-docs.js";
import { resolveTemplateEcosystem } from "./manifest.js";

export type OutputValidation = { ok: boolean; errors: string[] };

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function validateCommonLayout(targetDir: string, templateId: string, errors: string[]): void {
  const template = getTemplate(templateId);
  for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
    if (fs.existsSync(path.join(targetDir, leaked))) {
      errors.push(`Generated project must not contain '${leaked}'.`);
    }
  }

  if (template?.srcDir && template.srcDir !== "src" && fs.existsSync(path.join(targetDir, "src"))) {
    errors.push(
      `Template '${template.id}' must not keep a top-level src/ (expected fold into ${template.srcDir}/).`,
    );
  }

  const agentsDir = path.join(targetDir, ".agents");
  if (fs.existsSync(agentsDir)) {
    const cursor = path.join(targetDir, ".cursor");
    try {
      if (!fs.lstatSync(cursor).isSymbolicLink() || fs.readlinkSync(cursor) !== ".agents") {
        errors.push(".cursor must be a symlink to .agents when .agents exists.");
      }
    } catch {
      errors.push(".cursor must be a symlink to .agents when .agents exists.");
    }
  }
}

function validateNpmOutput(targetDir: string, config: ScaffoldConfig, errors: string[]): void {
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    errors.push("package.json is missing.");
    return;
  }

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;
  } catch (error) {
    errors.push(
      `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  if (pkg.name !== config.projectName) {
    errors.push(`package.json name is '${pkg.name}', expected '${config.projectName}'.`);
  }

  const overlayId = getTemplateOverlayId(config.templateId);
  for (const recipeId of config.recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      errors.push(`Unknown recipe '${recipeId}' in output validation.`);
      continue;
    }

    for (const [name, version] of Object.entries({
      ...recipe.packages,
      ...recipe.overlayPackages?.[overlayId],
    })) {
      if (pkg.dependencies?.[name] !== version) {
        errors.push(`Missing dependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, version] of Object.entries({
      ...recipe.devDependencies,
      ...recipe.overlayDevDependencies?.[overlayId],
    })) {
      if (pkg.devDependencies?.[name] !== version) {
        errors.push(`Missing devDependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, command] of Object.entries(recipe.scripts)) {
      if (pkg.scripts?.[name] !== command) {
        errors.push(`Missing script '${name}' from recipe '${recipeId}'.`);
      }
    }

    const entry = getRecipeAgentEntry(recipeId);
    if (!entry) continue;
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = path.join(targetDir, file);
      if (!fs.existsSync(filePath)) continue;
      const doc = fs.readFileSync(filePath, "utf-8");
      for (const line of entry
        .split("\n")
        .map((l) => l.trimEnd())
        .filter(Boolean)) {
        if (!doc.includes(line)) {
          errors.push(`${file} is missing agent entry line from recipe '${recipeId}'.`);
        }
      }
    }
  }
}

function validateGoOutput(targetDir: string, config: ScaffoldConfig, errors: string[]): void {
  const goModPath = path.join(targetDir, "go.mod");
  if (!fs.existsSync(goModPath)) {
    errors.push("go.mod is missing.");
    return;
  }

  const goMod = fs.readFileSync(goModPath, "utf-8");
  const moduleLine = goMod
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("module "));
  if (!moduleLine) {
    errors.push("go.mod is missing a module declaration.");
    return;
  }

  const modulePath = moduleLine.slice("module ".length).trim();
  if (!modulePath.includes(config.projectName) && modulePath !== config.projectName) {
    errors.push(
      `go.mod module is '${modulePath}', expected it to include project name '${config.projectName}'.`,
    );
  }

  if (fs.existsSync(path.join(targetDir, "package.json"))) {
    errors.push("Go templates must not include package.json.");
  }
}

/**
 * Structural checks on a generated (or staged) project. No network, no installs,
 * no running project scripts.
 */
export function validateGeneratedOutput(
  targetDir: string,
  config: ScaffoldConfig,
): OutputValidation {
  const errors: string[] = [];
  const template = getTemplate(config.templateId);
  if (!template) {
    return { ok: false, errors: [`Unknown template '${config.templateId}'.`] };
  }

  validateCommonLayout(targetDir, config.templateId, errors);

  const ecosystem = resolveTemplateEcosystem(config.templateId);
  if (ecosystem === "go") {
    validateGoOutput(targetDir, config, errors);
  } else {
    validateNpmOutput(targetDir, config, errors);
  }

  return { ok: errors.length === 0, errors };
}
