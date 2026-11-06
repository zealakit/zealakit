import fs from "node:fs";
import path from "node:path";
import { fse } from "../fs-extra.js";
import type { TemplateConfig } from "../types.js";
import {
  assertStagingRealPath,
  getRecipeDir,
  getTemplateDir,
  RECIPE_META_DIRS,
  RECIPE_SHARED_DIR,
  resolveRecipeOverlay,
  resolveStagingPath,
} from "./paths.js";

/** Local install/build junk that must never ship into a scaffolded app. */
const TEMPLATE_SKIP_NAMES = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".vite",
  "vendor",
]);

function shouldCopyTemplatePath(src: string): boolean {
  const base = path.basename(src);
  return !TEMPLATE_SKIP_NAMES.has(base) && !base.endsWith(".tsbuildinfo");
}

function copyDirectory(source: string, destination: string, filter?: (src: string) => boolean) {
  if (!fs.existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }
  fse.ensureDirSync(destination);
  fse.copySync(source, destination, { overwrite: true, errorOnExist: false, filter });
}

function isInsideRecipeMetaDir(recipeDir: string, srcPath: string): boolean {
  const relativePath = path.relative(recipeDir, srcPath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return false;
  }
  return RECIPE_META_DIRS.has(relativePath.split(path.sep)[0] ?? "");
}

/** npm strips these from published tarballs; `scripts/pack-dotfiles.ts` ships the packed names. */
export const PACKED_DOTFILES: Record<string, string> = { ".gitignore": "_gitignore" };

export function copyTemplate(templateId: string, targetDir: string): void {
  copyDirectory(getTemplateDir(templateId), targetDir, shouldCopyTemplatePath);

  for (const [dotfile, packedName] of Object.entries(PACKED_DOTFILES)) {
    const packed = path.join(targetDir, packedName);
    if (!fs.existsSync(packed)) continue;
    const dotfilePath = path.join(targetDir, dotfile);
    if (fs.existsSync(dotfilePath)) {
      fs.rmSync(packed);
    } else {
      fs.renameSync(packed, dotfilePath);
    }
  }
}

/** Copy order: recipe root (minus meta dirs) → `shared/` → `overlays/<overlayId>/`. */
export function copyRecipe(recipeId: string, templateId: string, targetDir: string): void {
  const recipeDir = getRecipeDir(recipeId);
  if (!fs.existsSync(recipeDir)) {
    throw new Error(`Recipe files do not exist: ${recipeId}`);
  }

  copyDirectory(recipeDir, targetDir, (src) => !isInsideRecipeMetaDir(recipeDir, src));

  const sharedDir = path.join(recipeDir, RECIPE_SHARED_DIR);
  if (fs.existsSync(sharedDir)) {
    copyDirectory(sharedDir, targetDir);
  }

  const overlay = resolveRecipeOverlay(recipeId, templateId);
  if (overlay.kind === "missing") {
    throw new Error(
      `Recipe '${recipeId}' has no overlay for template '${templateId}' (overlay '${overlay.overlayId}'). Available: ${overlay.available.join(", ") || "(none)"}.`,
    );
  }
  if (overlay.kind === "found") {
    copyDirectory(overlay.path, targetDir);
  }
}

/**
 * Recipe kernels ship under `src/`. Templates with another source root (Nuxt
 * `app/`) get that tree folded in so generated apps never keep a parallel `src/`.
 */
export function foldIntoSrcDir(template: TemplateConfig, targetDir: string): void {
  if (!template.srcDir || template.srcDir === "src") {
    return;
  }

  const recipeSrc = resolveStagingPath(targetDir, "src");
  if (!fs.existsSync(recipeSrc)) {
    return;
  }
  assertStagingRealPath(targetDir, recipeSrc);

  const appSrc = resolveStagingPath(targetDir, template.srcDir);
  if (fs.existsSync(appSrc)) {
    assertStagingRealPath(targetDir, appSrc);
  }
  fse.ensureDirSync(appSrc);
  fse.copySync(recipeSrc, appSrc, { overwrite: true, errorOnExist: false });
  fse.removeSync(recipeSrc);
}
