import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRecipe, getTemplate, getTemplateOverlayId } from "../registry/index.js";

/** Works from `src/**` (tsx) and from the bundled `dist/index.js`. */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    const manifest = path.join(dir, "package.json");
    if (fs.existsSync(manifest)) {
      const { name } = JSON.parse(fs.readFileSync(manifest, "utf-8")) as { name?: string };
      if (name === "zealakit") {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate the zealakit package root.");
    }
    dir = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, "templates");
export const RECIPES_DIR = path.join(PACKAGE_ROOT, "recipes");

export const RECIPE_OVERLAYS_DIR = "overlays";
export const RECIPE_SHARED_DIR = "shared";
export const RECIPE_SCAFFOLD_DIR = "scaffold";
export const RECIPE_META_DIRS = new Set([
  RECIPE_OVERLAYS_DIR,
  RECIPE_SHARED_DIR,
  RECIPE_SCAFFOLD_DIR,
]);

export function getTemplateDir(templateId: string): string {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Base template does not exist: ${templateId}`);
  }
  return path.join(TEMPLATES_DIR, template.path);
}

export function getRecipeDir(recipeId: string): string {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    throw new Error(`Recipe does not exist: ${recipeId}`);
  }
  return path.join(RECIPES_DIR, recipe.path ?? recipe.id);
}

/** Normalize case on case-insensitive platforms before containment checks. */
function comparablePath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

/** Whether `candidatePath` is `rootDir` itself or a descendant (lexical, no symlink resolution). */
export function isPathInsideRoot(rootDir: string, candidatePath: string): boolean {
  const relative = path.relative(
    comparablePath(path.resolve(rootDir)),
    comparablePath(path.resolve(candidatePath)),
  );
  if (relative === "") {
    return true;
  }
  if (path.isAbsolute(relative)) {
    return false;
  }
  return relative.split(path.sep)[0] !== "..";
}

/**
 * Resolve `targetPath` against the staging root and reject anything that would
 * land outside it. Absolute paths are accepted only when they stay inside.
 */
export function resolveStagingPath(stagingRoot: string, targetPath: string): string {
  const root = path.resolve(stagingRoot);
  const resolved = path.resolve(root, targetPath);
  if (!isPathInsideRoot(root, resolved)) {
    throw new Error(`Path '${targetPath}' resolves outside the staging directory '${root}'.`);
  }
  return resolved;
}

/**
 * Verify that an existing path still resolves inside the staging root after
 * following symbolic links. Call only for paths that already exist.
 */
export function assertStagingRealPath(stagingRoot: string, absolutePath: string): void {
  const root = path.resolve(stagingRoot);
  const realRoot = fs.realpathSync(root);
  const realTarget = fs.realpathSync(absolutePath);
  if (!isPathInsideRoot(realRoot, realTarget)) {
    throw new Error(
      `Path '${absolutePath}' escapes the staging directory '${root}' via a symbolic link.`,
    );
  }
}

/**
 * Reject symbolic links in the staged tree that point outside the staging root.
 *
 * Writes during generation must not follow such links. Links that stay inside
 * (including dangling relative links) are allowed; absolute links inside are
 * accepted after resolution.
 */
export function assertStagingSymlinksSafe(stagingRoot: string): void {
  const root = path.resolve(stagingRoot);
  const realRoot = fs.realpathSync(root);

  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(fullPath);
        const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget);
        if (!isPathInsideRoot(root, resolvedTarget)) {
          throw new Error(
            `Symbolic link '${fullPath}' points outside the staging directory '${root}'.`,
          );
        }
        if (fs.existsSync(fullPath)) {
          const realTarget = fs.realpathSync(fullPath);
          if (!isPathInsideRoot(realRoot, realTarget)) {
            throw new Error(
              `Symbolic link '${fullPath}' resolves outside the staging directory '${root}'.`,
            );
          }
        }
        continue;
      }
      if (entry.isDirectory()) {
        visit(fullPath);
      }
    }
  };

  visit(root);
}

export type OverlayResolution =
  /** Recipe has no `overlays/` folder */
  | { kind: "none" }
  | { kind: "found"; path: string }
  | { kind: "missing"; overlayId: string; available: string[] };

export function resolveRecipeOverlay(recipeId: string, templateId: string): OverlayResolution {
  const overlaysDir = path.join(getRecipeDir(recipeId), RECIPE_OVERLAYS_DIR);
  if (!fs.existsSync(overlaysDir)) {
    return { kind: "none" };
  }

  const overlayId = getTemplateOverlayId(templateId);
  const overlayPath = path.join(overlaysDir, overlayId);
  if (fs.existsSync(overlayPath)) {
    return { kind: "found", path: overlayPath };
  }

  const available = fs
    .readdirSync(overlaysDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return { kind: "missing", overlayId, available };
}
