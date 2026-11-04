import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fse from "fs-extra";
import { getRecipe, getTemplate } from "../registry/index.js";
import type { RecipeConfig, ScaffoldConfig } from "../types.js";
import { applyAgentEntry, ensureCursorAgentsSymlink } from "./agent-docs.js";
import { copyRecipe, copyTemplate, foldIntoSrcDir } from "./copy.js";
import { mergePackageJson } from "./package-json.js";
import { buildScaffoldPlan, planIsReady, type ScaffoldPlan } from "./plan.js";
import { applyFileTransforms } from "./transforms.js";
import { validateGeneratedOutput } from "./validate-output.js";

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

  for (const recipe of recipes) {
    copyRecipe(recipe.id, template.id, targetDir);
    foldIntoSrcDir(template, targetDir);
    applyAgentEntry(recipe.id, targetDir);
    applyFileTransforms(recipe, template.id, targetDir);
  }

  runFinalizers(recipes, targetDir);
  mergePackageJson(targetDir, plan.config);
  ensureCursorAgentsSymlink(targetDir);
}

function commitStage(stageDir: string, targetDir: string): void {
  fse.ensureDirSync(path.dirname(targetDir));
  if (fs.existsSync(targetDir)) {
    fse.emptyDirSync(targetDir);
    fse.copySync(stageDir, targetDir, { overwrite: true });
    fse.removeSync(stageDir);
    return;
  }
  try {
    fs.renameSync(stageDir, targetDir);
  } catch (error) {
    // Temp dir and project may be on different volumes (EXDEV).
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }
    fse.copySync(stageDir, targetDir, { overwrite: true });
    fse.removeSync(stageDir);
  }
}

/**
 * Pipeline: preflight plan → stage → validate → commit.
 * Callers must still confirm destination overwrite (`validateTargetDirectory`).
 */
export async function scaffoldProject(
  config: ScaffoldConfig,
  cwd: string = process.cwd(),
): Promise<string> {
  const plan = buildScaffoldPlan(config, cwd);
  if (!planIsReady(plan)) {
    throw new Error(plan.blockers.join("\n"));
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-stage-"));
  try {
    materialize(plan, stageDir);

    const output = validateGeneratedOutput(stageDir, plan.config);
    if (!output.ok) {
      throw new Error(`Post-generation validation failed:\n${output.errors.join("\n")}`);
    }

    commitStage(stageDir, plan.targetDir);
    return plan.targetDir;
  } catch (error) {
    fse.removeSync(stageDir);
    throw error;
  }
}
