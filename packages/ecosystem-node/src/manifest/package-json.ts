import fs from "node:fs";
import {
  assertStagingRealPath,
  type ManifestFieldConflict,
  resolveStagingPath,
  type ScaffoldConfig,
} from "@zealakit/core";
import { planPackageMerges } from "./package-plan.js";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeConflict(conflict: ManifestFieldConflict): string {
  return `${conflict.field} '${conflict.key}': '${conflict.left.recipeId}' wants '${conflict.left.value}', '${conflict.right.recipeId}' wants '${conflict.right.value}'`;
}

function readManifest(packageJsonPath: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `Invalid package.json at '${packageJsonPath}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!isJsonObject(parsed)) {
    throw new Error(`Invalid package.json at '${packageJsonPath}': expected a JSON object.`);
  }
  return parsed;
}

/**
 * Merge recipe additions into an existing manifest field. Existing entries are
 * preserved; recipe contributions override the template deterministically.
 */
function mergeStringRecord(
  packageJson: JsonObject,
  field: "dependencies" | "devDependencies" | "scripts",
  additions: Record<string, string>,
  packageJsonPath: string,
): void {
  if (Object.keys(additions).length === 0) {
    return;
  }

  const existing = packageJson[field];
  const current: Record<string, string> = {};
  if (existing !== undefined) {
    if (!isJsonObject(existing)) {
      throw new Error(
        `Invalid package.json at '${packageJsonPath}': '${field}' must be an object.`,
      );
    }
    for (const [name, value] of Object.entries(existing)) {
      if (typeof value !== "string") {
        throw new Error(
          `Invalid package.json at '${packageJsonPath}': '${field}.${name}' must be a string.`,
        );
      }
      current[name] = value;
    }
  }

  packageJson[field] = { ...current, ...additions };
}

export function mergePackageJson(targetDir: string, config: ScaffoldConfig): void {
  const packageJsonPath = resolveStagingPath(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found in template at ${targetDir}`);
  }
  assertStagingRealPath(targetDir, packageJsonPath);

  // Reuse the planning merge rules so apply-time behavior matches dry-run.
  const plan = planPackageMerges(config);
  if (plan.conflicts.length > 0) {
    throw new Error(
      `Conflicting manifest contributions:\n${plan.conflicts.map(describeConflict).join("\n")}`,
    );
  }

  const packageJson = readManifest(packageJsonPath);
  packageJson.name = config.projectName;
  mergeStringRecord(packageJson, "dependencies", plan.dependencies, packageJsonPath);
  mergeStringRecord(packageJson, "devDependencies", plan.devDependencies, packageJsonPath);
  mergeStringRecord(packageJson, "scripts", plan.scripts, packageJsonPath);

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf-8");
}
