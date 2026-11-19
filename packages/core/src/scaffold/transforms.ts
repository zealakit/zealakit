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

/** `JSON.stringify` with 2-space indent that keeps arrays of scalars on one line. */
export function stringifyJsonDocument(value: unknown): string {
  const render = (node: unknown, indent: string): string => {
    if (Array.isArray(node)) {
      if (node.length === 0) return "[]";
      if (node.every((item) => item === null || typeof item !== "object")) {
        return `[${node.map((item) => JSON.stringify(item)).join(", ")}]`;
      }
      const inner = `${indent}  `;
      return `[\n${node.map((item) => `${inner}${render(item, inner)}`).join(",\n")}\n${indent}]`;
    }
    if (node !== null && typeof node === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.length === 0) return "{}";
      const inner = `${indent}  `;
      const body = entries
        .map(([key, item]) => `${inner}${JSON.stringify(key)}: ${render(item, inner)}`)
        .join(",\n");
      return `{\n${body}\n${indent}}`;
    }
    return JSON.stringify(node);
  };
  return `${render(value, "")}\n`;
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

  if (transform.json) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Recipe '${recipeId}' json transform: ${transform.file} is not valid JSON`);
    }
    transform.json(data);
    return stringifyJsonDocument(data);
  }

  if (transform.marker !== undefined) {
    if (transform.insert === undefined || transform.insert.trim() === "") {
      throw new Error(`Recipe '${recipeId}' marker transform for ${transform.file} has no insert`);
    }
    const lines = raw.split("\n");
    const index = lines.findIndex((line) => line.includes(transform.marker as string));
    if (index === -1) {
      throw new Error(
        `Recipe '${recipeId}' marker '${transform.marker}' not found in ${transform.file}`,
      );
    }
    const indent = /^\s*/.exec(lines[index] ?? "")?.[0] ?? "";
    const inserted = transform.insert
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => (line === "" ? line : `${indent}${line}`));
    lines.splice(transform.position === "before" ? index : index + 1, 0, ...inserted);
    return lines.join("\n");
  }

  if (transform.pattern && transform.replacement !== undefined) {
    const next = raw.replace(transform.pattern, transform.replacement);
    if (next === raw) {
      throw new Error(`Recipe '${recipeId}' transform did not match in ${transform.file}`);
    }
    return next;
  }

  throw new Error(
    `Recipe '${recipeId}' transform for ${transform.file} needs either append, marker/insert, json, or pattern/replacement`,
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
