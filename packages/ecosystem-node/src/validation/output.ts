import fs from "node:fs";
import path from "node:path";

import {
  getRecipe,
  getRecipeAgentEntry,
  getTemplateOverlayId,
  type ScaffoldConfig,
} from "@zealakit/core/ecosystem";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function validateNpmOutput(targetDir: string, config: ScaffoldConfig): string[] {
  const errors: string[] = [];
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    errors.push("package.json is missing.");
    return errors;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch (error) {
    errors.push(
      `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return errors;
  }
  if (!isJsonObject(parsed)) {
    errors.push("package.json must contain a JSON object.");
    return errors;
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

    if (recipe.manifest.ecosystem !== "node") continue;
    const npm = recipe.manifest;

    for (const [name, version] of Object.entries({
      ...npm.packages,
      ...npm.overlayPackages?.[overlayId],
    })) {
      if (dependencies?.[name] !== version) {
        errors.push(`Missing dependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, version] of Object.entries({
      ...npm.devDependencies,
      ...npm.overlayDevDependencies?.[overlayId],
    })) {
      if (devDependencies?.[name] !== version) {
        errors.push(`Missing devDependency ${name}@${version} from recipe '${recipeId}'.`);
      }
    }
    for (const [name, command] of Object.entries(npm.scripts)) {
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
  return errors;
}
