import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import { getRecipe, getTemplate } from "../registry/index.js";
import type { RecipeConfig, ScaffoldConfig } from "../types.js";
import { applyAgentEntry, ensureCursorAgentsSymlink } from "./agent-docs.js";
import { copyRecipe, copyTemplate, foldIntoSrcDir } from "./copy.js";
import { mergePackageJson } from "./package-json.js";
import { applyFileTransforms } from "./transforms.js";

/**
 * Pipeline: template → per recipe (copy → fold srcDir → agent entry → transforms)
 * → recipe finalizers → package.json merge → `.cursor` symlink.
 * Callers must validate the config first (`validateScaffoldInput`).
 */
export async function scaffoldProject(
  config: ScaffoldConfig,
  cwd: string = process.cwd(),
): Promise<string> {
  const template = getTemplate(config.templateId);
  if (!template) {
    throw new Error(`Base template does not exist: ${config.templateId}`);
  }

  const recipes = config.recipeIds.map((id) => {
    const recipe = getRecipe(id);
    if (!recipe) {
      throw new Error(`Unknown recipe: ${id}`);
    }
    return recipe;
  });

  const targetDir = path.resolve(cwd, config.projectName);
  if (fs.existsSync(targetDir)) {
    fse.emptyDirSync(targetDir);
  }
  fse.ensureDirSync(targetDir);

  copyTemplate(template.id, targetDir);

  for (const recipe of recipes) {
    copyRecipe(recipe.id, template.id, targetDir);
    foldIntoSrcDir(template, targetDir);
    applyAgentEntry(recipe.id, targetDir);
    applyFileTransforms(recipe, template.id, targetDir);
  }

  runFinalizers(recipes, targetDir);
  mergePackageJson(targetDir, config);
  ensureCursorAgentsSymlink(targetDir);

  return targetDir;
}

function runFinalizers(recipes: RecipeConfig[], targetDir: string): void {
  for (const recipe of recipes) {
    recipe.finalize?.(targetDir);
  }
}
