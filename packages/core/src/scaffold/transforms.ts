import fs from "node:fs";
import { getTemplateOverlayId } from "../registry/index.js";
import type { RecipeConfig, RecipeFileTransform } from "../types.js";
import { assertStagingRealPath, resolveStagingPath } from "./paths.js";

export function getRecipeTransforms(
  recipe: RecipeConfig,
  templateId: string,
): RecipeFileTransform[] {
  return (
    recipe.fileTransforms?.[templateId] ??
    recipe.fileTransforms?.[getTemplateOverlayId(templateId)] ??
    []
  );
}

/** Pure text transform; throws when a pattern does not match so recipes never silently no-op. */
export function transformSource(
  recipeId: string,
  transform: RecipeFileTransform,
  raw: string,
): string {
  if (transform.append !== undefined) {
    const line = transform.append.trim();
    if (!line) {
      throw new Error(`Recipe '${recipeId}' append transform for ${transform.file} is empty`);
    }
    if (raw.includes(line)) {
      return raw;
    }
    const appended = transform.append.endsWith("\n") ? transform.append : `${transform.append}\n`;
    return `${raw.trimEnd()}\n${appended}`;
  }

  if (transform.pattern && transform.replacement !== undefined) {
    const next = raw.replace(transform.pattern, transform.replacement);
    if (next === raw) {
      throw new Error(`Recipe '${recipeId}' transform did not match in ${transform.file}`);
    }
    return next;
  }

  throw new Error(
    `Recipe '${recipeId}' transform for ${transform.file} needs either append or pattern/replacement`,
  );
}

export function applyFileTransforms(
  recipe: RecipeConfig,
  templateId: string,
  targetDir: string,
): void {
  for (const transform of getRecipeTransforms(recipe, templateId)) {
    // Transforms only ever touch generated files inside the staging directory.
    const filePath = resolveStagingPath(targetDir, transform.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recipe '${recipe.id}' transform target not found: ${transform.file}`);
    }
    assertStagingRealPath(targetDir, filePath);

    const raw = fs.readFileSync(filePath, "utf-8");
    const next = transformSource(recipe.id, transform, raw);
    if (next !== raw) {
      fs.writeFileSync(filePath, next, "utf-8");
    }
  }
}
