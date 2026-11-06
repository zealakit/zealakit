import fs from "node:fs";
import path from "node:path";
import { getRecipe, getTemplate, getTemplateOverlayId } from "../registry/index.js";
import type { ScaffoldConfig } from "../types.js";
import { getRecipeAgentEntry } from "./agent-docs.js";
import { resolveTemplateEcosystem } from "./manifest.js";
import { assertStagingRealPath, assertStagingSymlinksSafe, isPathInsideRoot } from "./paths.js";

export type OutputValidation = { ok: boolean; errors: string[] };

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lstatOrUndefined(target: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(target);
  } catch {
    return undefined;
  }
}

/** Read an optional `Record<string, string>` field, reporting invalid shapes. */
function readStringRecord(
  value: unknown,
  field: string,
  errors: string[],
): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    errors.push(`package.json field '${field}' must be an object.`);
    return undefined;
  }
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      errors.push(`package.json field '${field}.${key}' must be a string.`);
      continue;
    }
    record[key] = entry;
  }
  return record;
}

/**
 * `.cursor` must be a relative symlink to `.agents`; the link must not escape
 * the generated project (checked both lexically and after resolving symlinks).
 */
function validateAgentConfiguration(targetDir: string, errors: string[]): void {
  const agentsDir = path.join(targetDir, ".agents");
  const cursorPath = path.join(targetDir, ".cursor");
  const cursorStat = lstatOrUndefined(cursorPath);
  const agentsExists = fs.existsSync(agentsDir);

  if (!agentsExists) {
    if (cursorStat) {
      errors.push("Generated project has '.cursor' but no '.agents' directory.");
    }
    return;
  }

  if (!fs.statSync(agentsDir).isDirectory()) {
    errors.push("Generated project '.agents' must be a directory.");
    return;
  }
  try {
    assertStagingRealPath(targetDir, agentsDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return;
  }

  if (!cursorStat) {
    errors.push("'.cursor' must be a symlink to '.agents'.");
    return;
  }
  if (!cursorStat.isSymbolicLink()) {
    errors.push("'.cursor' must be a symlink to '.agents' (found a file or directory).");
    return;
  }

  let linkTarget: string;
  try {
    linkTarget = fs.readlinkSync(cursorPath);
  } catch {
    errors.push("'.cursor' must be a readable symlink to '.agents'.");
    return;
  }
  if (linkTarget !== ".agents") {
    errors.push(`'.cursor' must point to '.agents' (found '${linkTarget}').`);
    return;
  }

  try {
    const realRoot = fs.realpathSync(targetDir);
    const realCursor = fs.realpathSync(cursorPath);
    if (!isPathInsideRoot(realRoot, realCursor)) {
      errors.push("'.cursor' resolves outside the generated project.");
    }
  } catch {
    errors.push("'.cursor' is a broken symlink.");
  }
}

/** No generated symlink may point outside the staged project. */
function validateSymlinkSafety(targetDir: string, errors: string[]): void {
  try {
    assertStagingSymlinksSafe(targetDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

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

  if (fs.readdirSync(targetDir).length === 0) {
    errors.push("Generated project is empty.");
    return;
  }

  validateAgentConfiguration(targetDir, errors);
  validateSymlinkSafety(targetDir, errors);
}

function validateNpmOutput(targetDir: string, config: ScaffoldConfig, errors: string[]): void {
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    errors.push("package.json is missing.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch (error) {
    errors.push(
      `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if (!isJsonObject(parsed)) {
    errors.push("package.json must contain a JSON object.");
    return;
  }

  if (parsed.name !== config.projectName) {
    errors.push(`package.json name is '${String(parsed.name)}', expected '${config.projectName}'.`);
  }
  for (const field of ["version", "type", "packageManager"]) {
    if (parsed[field] !== undefined && typeof parsed[field] !== "string") {
      errors.push(`package.json field '${field}' must be a string.`);
    }
  }
  if (parsed.private !== undefined && typeof parsed.private !== "boolean") {
    errors.push("package.json field 'private' must be a boolean.");
  }
  if (parsed.engines !== undefined && !isJsonObject(parsed.engines)) {
    errors.push("package.json field 'engines' must be an object.");
  }

  const dependencies = readStringRecord(parsed.dependencies, "dependencies", errors);
  const devDependencies = readStringRecord(parsed.devDependencies, "devDependencies", errors);
  const scripts = readStringRecord(parsed.scripts, "scripts", errors);
  readStringRecord(parsed.peerDependencies, "peerDependencies", errors);
  readStringRecord(parsed.optionalDependencies, "optionalDependencies", errors);

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
      if (dependencies?.[name] !== version) {
        errors.push(`Missing dependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, version] of Object.entries({
      ...recipe.devDependencies,
      ...recipe.overlayDevDependencies?.[overlayId],
    })) {
      if (devDependencies?.[name] !== version) {
        errors.push(`Missing devDependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, command] of Object.entries(recipe.scripts)) {
      if (scripts?.[name] !== command) {
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
