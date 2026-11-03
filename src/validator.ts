import fs from "node:fs";
import path from "node:path";
import { cancel, confirm, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { UI_FRAMEWORK_CATEGORIES } from "./constants.js";
import {
  getAllTemplateIds,
  getRecipe,
  getRecipeCategories,
  getTemplate,
  getTemplateOverlayId,
} from "./registry/index.js";
import type {
  CliOptions,
  RecipeConfig,
  Scope,
  UiFrameworkCategory,
  ValidationResult,
} from "./types.js";

const NPM_NAME_PATTERN = /^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const RESERVED_NAMES = new Set([
  "node_modules",
  "favicon.ico",
  "package.json",
  "package-lock.json",
]);

export function isRecipeSupportedForScope(recipe: RecipeConfig, templateScope: Scope): boolean {
  if (recipe.supportedScopes === "all") {
    return true;
  }

  if (templateScope === "hybrid") {
    return (
      recipe.supportedScopes.includes("client") ||
      recipe.supportedScopes.includes("server") ||
      recipe.supportedScopes.includes("hybrid")
    );
  }

  return recipe.supportedScopes.includes(templateScope);
}

export function isValidNpmPackageName(name: string): boolean {
  if (!name || name.length > 214) {
    return false;
  }

  if (name !== name.toLowerCase()) {
    return false;
  }

  if (name.startsWith(".") || name.startsWith("_")) {
    return false;
  }

  if (RESERVED_NAMES.has(name)) {
    return false;
  }

  return NPM_NAME_PATTERN.test(name);
}

export function validateProjectName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("Project name cannot be empty.");
    return { valid: false, errors };
  }

  if (!isValidNpmPackageName(name)) {
    errors.push(
      `Project name "${name}" is invalid. Names must follow npm naming rules (lowercase, no spaces, cannot start with "." or "_").`,
    );
  }

  return { valid: errors.length === 0, errors };
}

export function directoryHasFiles(targetDir: string): boolean {
  if (!fs.existsSync(targetDir)) {
    return false;
  }

  const entries = fs.readdirSync(targetDir);
  return entries.length > 0;
}

export async function validateTargetDirectory(
  projectName: string,
  cwd: string,
  options: Pick<CliOptions, "yes">,
): Promise<ValidationResult> {
  const targetDir = path.resolve(cwd, projectName);

  if (!directoryHasFiles(targetDir)) {
    return { valid: true, errors: [] };
  }

  if (options.yes) {
    return {
      valid: false,
      errors: [
        `Directory "${projectName}" already exists and is not empty. Re-run without -y to confirm overwrite, or choose a different name.`,
      ],
    };
  }

  const shouldOverwrite = await confirm({
    message: `Directory "${projectName}" already exists. Overwrite?`,
    initialValue: false,
  });

  if (isCancel(shouldOverwrite)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  if (!shouldOverwrite) {
    return {
      valid: false,
      errors: ["Scaffold cancelled because the target directory already exists."],
    };
  }

  return { valid: true, errors: [] };
}

export function validateTemplate(templateId: string): ValidationResult {
  const template = getTemplate(templateId);

  if (!template) {
    return {
      valid: false,
      errors: [
        `Template "${templateId}" does not exist. Available templates: ${getAllTemplateIds().join(", ")}.`,
      ],
    };
  }

  return { valid: true, errors: [] };
}

export function validateRecipeIds(recipeIds: string[]): ValidationResult {
  const errors: string[] = [];
  const unknown = recipeIds.filter((id) => !getRecipe(id));

  if (unknown.length > 0) {
    errors.push(`Invalid recipe(s): ${unknown.map((id) => `'${id}'`).join(", ")}.`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateRecipeConflicts(recipeIds: string[]): ValidationResult {
  const errors: string[] = [];
  const categoryMap = new Map<string, string[]>();

  for (const recipeId of recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      continue;
    }

    for (const category of getRecipeCategories(recipe)) {
      const existing = categoryMap.get(category) ?? [];
      existing.push(recipeId);
      categoryMap.set(category, existing);
    }
  }

  for (const [category, ids] of categoryMap.entries()) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length <= 1) {
      continue;
    }

    const recipesInCategory = uniqueIds
      .map((id) => getRecipe(id))
      .filter((recipe): recipe is RecipeConfig => recipe !== undefined);

    const exclusiveIds = recipesInCategory.filter((recipe) => recipe.exclusive).map((r) => r.id);
    if (exclusiveIds.length <= 1) {
      // Multiple non-exclusive recipes (e.g. Storybook + a UI kit) are allowed.
      // Conflict only when 2+ exclusive recipes share a category.
      continue;
    }

    const names = exclusiveIds.map((id) => `'${id}'`).join(" and ");

    if (category === "linter" && exclusiveIds.length === 2) {
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the linter group. Please choose only one.`,
      );
      continue;
    }

    if (category === "state" && exclusiveIds.length >= 2) {
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the state group. Please choose only one.`,
      );
      continue;
    }

    if (category === "fetcher" && exclusiveIds.length >= 2) {
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the fetcher group. Please choose only one.`,
      );
      continue;
    }

    if (
      (category === "ui" || (UI_FRAMEWORK_CATEGORIES as readonly string[]).includes(category)) &&
      exclusiveIds.length >= 2
    ) {
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the ${category} group. Please choose only one.`,
      );
      continue;
    }

    if (category === "orm" && exclusiveIds.length >= 2) {
      errors.push(
        `✖ Conflict: Cannot select both ${names} in the orm group. Please choose only one.`,
      );
      continue;
    }

    errors.push(
      `✖ Conflict: Cannot select both ${names} in the ${category} group. Please choose only one.`,
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateScopeCompatibility(
  templateId: string,
  recipeIds: string[],
): ValidationResult {
  const errors: string[] = [];
  const template = getTemplate(templateId);

  if (!template) {
    return { valid: true, errors: [] };
  }

  for (const recipeId of recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      continue;
    }

    if (!isRecipeSupportedForScope(recipe, template.scope)) {
      errors.push(
        `✖ Recipe '${recipeId}' is incompatible with template scope '${template.scope}'.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function getUiFrameworkCategory(templateId: string): UiFrameworkCategory | undefined {
  const overlay = getTemplateOverlayId(templateId);

  if (overlay === "vite-react" || overlay === "next") {
    return "ui-react";
  }

  if (overlay === "vite-vue" || overlay === "nuxt") {
    return "ui-vue";
  }

  if (overlay === "vite-svelte" || overlay === "sveltekit") {
    return "ui-svelte";
  }

  return undefined;
}

/** Reject React-only / Vue-only recipes on the wrong SPA family. */
export function validateUiFrameworkCompatibility(
  templateId: string,
  recipeIds: string[],
): ValidationResult {
  const errors: string[] = [];
  const family = getUiFrameworkCategory(templateId);

  if (!family) {
    return { valid: true, errors: [] };
  }

  for (const recipeId of recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      continue;
    }

    const cats = getRecipeCategories(recipe);
    const frameworkTags = cats.filter((category): category is UiFrameworkCategory =>
      (UI_FRAMEWORK_CATEGORIES as readonly string[]).includes(category),
    );

    if (frameworkTags.length === 0) {
      // Framework-specific recipes without a ui-* tag.
      if (family === "ui-vue" && recipeId === "hookform-zod") {
        errors.push(
          `✖ Recipe 'hookform-zod' targets React. Use 'vee-validate-zod' with template '${templateId}'.`,
        );
      }
      if (family === "ui-react" && recipeId === "vee-validate-zod") {
        errors.push(
          `✖ Recipe 'vee-validate-zod' targets Vue. Use 'hookform-zod' with template '${templateId}'.`,
        );
      }
      if (family === "ui-vue" && recipeId === "zustand") {
        errors.push(
          `✖ Recipe 'zustand' targets React. Use 'pinia' (or 'nanostores') with template '${templateId}'.`,
        );
      }
      if (family === "ui-react" && recipeId === "pinia") {
        errors.push(
          `✖ Recipe 'pinia' targets Vue. Use 'zustand' (or 'nanostores') with template '${templateId}'.`,
        );
      }
      continue;
    }

    if (!frameworkTags.includes(family)) {
      errors.push(
        `✖ Recipe '${recipeId}' (${frameworkTags.join(", ")}) is incompatible with template '${templateId}' (${family}).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validateScaffoldInput(
  projectName: string,
  templateId: string,
  recipeIds: string[],
  cwd: string,
  options: Pick<CliOptions, "yes">,
): Promise<ValidationResult> {
  const allErrors: string[] = [];

  const checks: ValidationResult[] = [
    validateProjectName(projectName),
    validateTemplate(templateId),
    validateRecipeIds(recipeIds),
    validateRecipeConflicts(recipeIds),
    validateScopeCompatibility(templateId, recipeIds),
    validateUiFrameworkCompatibility(templateId, recipeIds),
  ];

  for (const check of checks) {
    allErrors.push(...check.errors);
  }

  if (allErrors.length > 0) {
    return { valid: false, errors: allErrors };
  }

  const dirCheck = await validateTargetDirectory(projectName, cwd, options);
  if (!dirCheck.valid) {
    return dirCheck;
  }

  return { valid: true, errors: [] };
}

export function printValidationErrors(errors: string[]): void {
  for (const error of errors) {
    console.error(pc.red(error));
  }
}
