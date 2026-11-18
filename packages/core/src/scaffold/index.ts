import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ScaffoldValidationError } from "../diagnostics.js";
import { fse } from "../fs-extra.js";
import { getRecipe, getTemplate } from "../registry/index.js";
import type { RecipeConfig, ScaffoldConfig } from "../types.js";
import {
  directoryHasFiles,
  nonEmptyTargetMessage,
  type OverwritePolicy,
} from "../validation/target-dir.js";
import { applyAgentEntry, ensureCursorAgentsSymlink } from "./agent-docs.js";
import { commitStagedDirectory } from "./commit.js";
import { copyRecipe, copyTemplate, foldIntoSrcDir } from "./copy.js";
import { getManifestAdapterForConfig } from "./manifest.js";
import { assertStagingSymlinksSafe } from "./paths.js";
import { buildScaffoldPlan, planIsReady, type ScaffoldPlan } from "./plan.js";
import { applyFileTransforms } from "./transforms.js";
import { validateGeneratedOutput } from "./validate-output.js";

export {
  emptyPackagePlan,
  getManifestAdapter,
  getManifestAdapterForConfig,
  type ManifestAdapter,
  type ManifestFieldConflict,
  type NextSteps,
  type PackagePlan,
  resolveTemplateEcosystem,
  setManifestAdapter,
} from "./manifest.js";
export { buildScaffoldPlan, planIsReady, type ScaffoldPlan } from "./plan.js";
export { validateGeneratedOutput } from "./validate-output.js";

function runFinalizers(recipes: RecipeConfig[], targetDir: string): void {
  for (const recipe of recipes) {
    recipe.finalize?.(targetDir);
  }
}

/** Materialize a plan into `targetDir` (must be empty or non-existent). */
function materialize(plan: ScaffoldPlan, targetDir: string): void {
  const template = getTemplate(plan.config.templateId);
  if (!template) {
    throw new Error(`Base template does not exist: ${plan.config.templateId}`);
  }

  const recipes = plan.config.recipeIds.map((id) => {
    const recipe = getRecipe(id);
    if (!recipe) {
      throw new Error(`Unknown recipe: ${id}`);
    }
    return recipe;
  });

  fse.ensureDirSync(targetDir);
  copyTemplate(template.id, targetDir);
  // Any later write must not follow a staged symlink that escapes the staging root.
  assertStagingSymlinksSafe(targetDir);

  for (const recipe of recipes) {
    copyRecipe(recipe.id, template.id, targetDir);
    foldIntoSrcDir(template, targetDir);
    applyAgentEntry(recipe.id, targetDir);
    applyFileTransforms(recipe, template.id, targetDir);
  }

  // Recipes are bundled and every transform/fold re-checks its real path, so one
  // full walk after all copies (before finalizers write) is enough.
  assertStagingSymlinksSafe(targetDir);

  runFinalizers(recipes, targetDir);
  getManifestAdapterForConfig(plan.config).applyMerges(targetDir, plan.config);
  ensureCursorAgentsSymlink(targetDir);
}

export type ExecutePlanOptions = {
  /**
   * `refuse` throws when the destination already has files; `allow` replaces it
   * (the caller has obtained consent). Omit to leave the check to the caller.
   */
  overwrite?: OverwritePolicy;
};

/**
 * Pipeline back half: stage → validate output → commit. Takes a plan that
 * `buildScaffoldPlan` already produced, so dependency resolution and config
 * validation run exactly once per scaffold.
 */
export async function executeScaffoldPlan(
  plan: ScaffoldPlan,
  options: ExecutePlanOptions = {},
): Promise<string> {
  if (!planIsReady(plan)) {
    throw new ScaffoldValidationError(plan.blockers.join("\n"), plan.blockers);
  }
  if (options.overwrite === "refuse" && directoryHasFiles(plan.targetDir)) {
    const message = nonEmptyTargetMessage(plan.config.projectName);
    throw new ScaffoldValidationError(message, [message]);
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-stage-"));
  try {
    materialize(plan, stageDir);

    const output = validateGeneratedOutput(stageDir, plan.config);
    if (!output.ok) {
      throw new ScaffoldValidationError(
        `Post-generation validation failed:\n${output.errors.join("\n")}`,
        output.errors,
      );
    }

    commitStagedDirectory(stageDir, plan.targetDir);
    return plan.targetDir;
  } catch (error) {
    // Staging cleanup is best-effort: never mask the original failure.
    try {
      fse.removeSync(stageDir);
    } catch {
      // Leave the staging dir for diagnostics; the original error is rethrown.
    }
    throw error;
  }
}

/**
 * Convenience: `executeScaffoldPlan(buildScaffoldPlan(config))`.
 * Callers must still decide the destination overwrite policy.
 */
export async function scaffoldProject(
  config: ScaffoldConfig,
  cwd: string = process.cwd(),
  options: ExecutePlanOptions = {},
): Promise<string> {
  return executeScaffoldPlan(buildScaffoldPlan(config, cwd), options);
}
