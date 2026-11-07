import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TemplateConfig } from "../types.js";
import {
  getRecipeDir,
  getTemplateDir,
  RECIPE_META_DIRS,
  RECIPE_SHARED_DIR,
  resolveRecipeOverlay,
} from "./paths.js";

export type FileSourceKind = "template" | "recipe-root" | "recipe-shared" | "recipe-overlay";

export type PlannedFileSource = {
  kind: FileSourceKind;
  origin: string;
  absolutePath: string;
  digest: string;
};

export const TEMPLATE_SKIP_NAMES = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".vite",
  ".svelte-kit",
  "build",
  "storybook-static",
]);

function shouldSkipName(base: string): boolean {
  return TEMPLATE_SKIP_NAMES.has(base) || base.endsWith(".tsbuildinfo");
}

function digestFile(absolutePath: string): string {
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return createHash("sha1")
      .update(`symlink:${fs.readlinkSync(absolutePath)}`)
      .digest("hex");
  }
  if (stat.isDirectory()) {
    return createHash("sha1").update("dir").digest("hex");
  }
  return createHash("sha1").update(fs.readFileSync(absolutePath)).digest("hex");
}

/** Walk `root` and yield relative posix paths → absolute file paths (files + symlinks only). */
export function walkFiles(
  root: string,
  options: { skip?: (relativePosix: string, absolutePath: string) => boolean } = {},
): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(root)) {
    return out;
  }

  const visit = (absoluteDir: string, relativeDir: string): void => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (shouldSkipName(entry.name)) continue;
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePosix = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (options.skip?.(relativePosix, absolutePath)) continue;

      if (entry.isDirectory()) {
        visit(absolutePath, relativePosix);
        continue;
      }
      // Files and symlinks (including `.cursor`) — directories are walked, not emitted.
      out.set(relativePosix, absolutePath);
    }
  };

  visit(root, "");
  return out;
}

export function listTemplateFiles(templateId: string): Map<string, PlannedFileSource> {
  const root = getTemplateDir(templateId);
  const files = walkFiles(root);
  const result = new Map<string, PlannedFileSource>();
  for (const [relative, absolutePath] of files) {
    // Packed install ships `_gitignore`; scaffolder renames to `.gitignore`.
    const targetRelative = relative.endsWith("/_gitignore")
      ? relative.replace(/\/_gitignore$/, "/.gitignore")
      : relative === "_gitignore"
        ? ".gitignore"
        : relative;
    result.set(targetRelative, {
      kind: "template",
      origin: templateId,
      absolutePath,
      digest: digestFile(absolutePath),
    });
  }
  return result;
}

export function listRecipeFiles(
  recipeId: string,
  templateId: string,
  template: TemplateConfig,
): Map<string, PlannedFileSource> {
  const recipeDir = getRecipeDir(recipeId);
  const result = new Map<string, PlannedFileSource>();

  const addLayer = (
    root: string,
    kind: FileSourceKind,
    origin: string,
    mapRelative: (relative: string) => string = (relative) => relative,
  ): void => {
    if (!fs.existsSync(root)) return;
    const skipMeta =
      kind === "recipe-root"
        ? (relative: string) => RECIPE_META_DIRS.has(relative.split("/")[0] ?? "")
        : undefined;
    for (const [relative, absolutePath] of walkFiles(root, {
      skip: skipMeta ? (relative) => skipMeta(relative) : undefined,
    })) {
      let targetRelative = mapRelative(relative);
      // Fold recipe `src/` into template.srcDir (Nuxt → `app/`).
      if (template.srcDir && template.srcDir !== "src") {
        if (targetRelative === "src" || targetRelative.startsWith("src/")) {
          targetRelative = targetRelative.replace(/^src/, template.srcDir);
        }
      }
      result.set(targetRelative, {
        kind,
        origin,
        absolutePath,
        digest: digestFile(absolutePath),
      });
    }
  };

  addLayer(recipeDir, "recipe-root", recipeId);
  addLayer(path.join(recipeDir, RECIPE_SHARED_DIR), "recipe-shared", `${recipeId}/shared`);

  const overlay = resolveRecipeOverlay(recipeId, templateId);
  if (overlay.kind === "found") {
    addLayer(overlay.path, "recipe-overlay", `${recipeId}/overlays/${path.basename(overlay.path)}`);
  }

  return result;
}
