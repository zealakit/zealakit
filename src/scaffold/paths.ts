import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTemplate, getTemplateOverlayId } from "../registry/index.js";

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
  return path.join(RECIPES_DIR, recipeId);
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
