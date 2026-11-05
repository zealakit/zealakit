import { printError } from "../diagnostics.js";
import { getTemplate } from "../registry/index.js";
import { getManifestAdapter } from "../scaffold/manifest.js";
import type { CliOptions, EcosystemId, ScaffoldConfig, ValidationResult } from "../types.js";
import {
  validateRecipeCompatibility,
  validateRecipeConflicts,
  validateRecipeIds,
  validateTemplate,
} from "./recipes.js";
import { validateTargetDirectory } from "./target-dir.js";

export {
  validateRecipeCompatibility,
  validateRecipeConflicts,
  validateRecipeIds,
  validateTemplate,
} from "./recipes.js";
export { directoryHasFiles, validateTargetDirectory } from "./target-dir.js";

export function validateProjectName(
  name: string,
  templateIdOrEcosystem?: string,
): ValidationResult {
  let ecosystem: EcosystemId = "node";
  if (templateIdOrEcosystem === "node" || templateIdOrEcosystem === "go") {
    ecosystem = templateIdOrEcosystem;
  } else if (templateIdOrEcosystem) {
    ecosystem = getTemplate(templateIdOrEcosystem)?.ecosystem ?? "node";
  }
  return getManifestAdapter(ecosystem).validateProjectName(name);
}

/** All checks that do not touch the target directory (no prompts, no I/O on cwd). */
export function validateScaffoldConfig(config: ScaffoldConfig): ValidationResult {
  const errors = [
    validateProjectName(config.projectName, config.templateId),
    validateTemplate(config.templateId),
    validateRecipeIds(config.recipeIds),
    validateRecipeConflicts(config.recipeIds),
    validateRecipeCompatibility(config.templateId, config.recipeIds),
  ].flatMap((check) => check.errors);

  return { valid: errors.length === 0, errors };
}

export async function validateScaffoldInput(
  config: ScaffoldConfig,
  cwd: string,
  options: Pick<CliOptions, "yes">,
): Promise<ValidationResult> {
  const configCheck = validateScaffoldConfig(config);
  if (!configCheck.valid) {
    return configCheck;
  }
  return validateTargetDirectory(config.projectName, cwd, options);
}

export function printValidationErrors(errors: string[]): void {
  for (const [index, error] of errors.entries()) {
    if (index > 0) {
      console.error();
    }
    printError(error);
  }
}
