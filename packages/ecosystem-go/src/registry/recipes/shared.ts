import fs from "node:fs";
import path from "node:path";
import { assertStagingRealPath, resolveStagingPath } from "@zealakit/core/ecosystem";

/** Append missing `require` lines to the generated go.mod. */
export function addGoRequires(
  targetDir: string,
  modules: Record<string, string>,
  recipeName: string,
): void {
  const goModPath = resolveStagingPath(targetDir, "go.mod");
  if (!fs.existsSync(goModPath)) {
    throw new Error(`${recipeName} recipe requires a Go module (go.mod is missing).`);
  }
  assertStagingRealPath(targetDir, goModPath);

  let raw = fs.readFileSync(goModPath, "utf-8");
  for (const [modulePath, version] of Object.entries(modules)) {
    if (raw.includes(modulePath)) {
      continue;
    }
    raw = `${raw.trimEnd()}\n\nrequire ${modulePath} ${version}\n`;
  }
  fs.writeFileSync(goModPath, raw, "utf-8");
}

/** Append an environment section once, preserving the existing file. */
export function appendEnvSection(targetDir: string, marker: string, section: string): void {
  const envPath = resolveStagingPath(targetDir, ".env.example");
  if (!fs.existsSync(envPath)) {
    return;
  }
  assertStagingRealPath(targetDir, envPath);
  const raw = fs.readFileSync(envPath, "utf-8");
  if (raw.includes(marker)) {
    return;
  }
  fs.writeFileSync(envPath, `${raw.trimEnd()}\n\n${section.trimEnd()}\n`, "utf-8");
}

/** Merge a recipe's go.sum fragment into the generated go.sum. */
export function mergeGoSum(targetDir: string, fragmentPath: string): void {
  const sumPath = resolveStagingPath(targetDir, "go.sum");
  const fragment = fs.readFileSync(fragmentPath, "utf-8");
  const existing = fs.existsSync(sumPath) ? fs.readFileSync(sumPath, "utf-8") : "";
  if (fs.existsSync(sumPath)) {
    assertStagingRealPath(targetDir, sumPath);
  }

  const lines = new Set(existing.split(/\r?\n/).filter(Boolean));
  for (const line of fragment.split(/\r?\n/).filter(Boolean)) {
    lines.add(line);
  }
  fs.writeFileSync(sumPath, `${[...lines].join("\n")}\n`, "utf-8");
}

/** Append Makefile targets once (no-op when the marker is already present or there is no Makefile). */
export function appendMakefileTargets(targetDir: string, marker: string, targets: string): void {
  const file = resolveStagingPath(targetDir, "Makefile");
  if (!fs.existsSync(file)) {
    return;
  }
  assertStagingRealPath(targetDir, file);
  const raw = fs.readFileSync(file, "utf-8");
  if (raw.includes(marker)) {
    return;
  }
  fs.writeFileSync(file, `${raw.trimEnd()}\n\n${targets.trimEnd()}\n`, "utf-8");
}

export type SqlDialect = "postgres" | "mysql";

/** Which SQL database recipe is selected (`requiresAnyOf` guarantees one for migration/query tools). */
export function selectedSqlDialect(recipeIds: readonly string[]): SqlDialect {
  return recipeIds.includes("mysql") ? "mysql" : "postgres";
}

/** Write a generated file (creating folders) inside the staging directory. */
export function writeStagedFile(targetDir: string, relativePath: string, content: string): void {
  const file = resolveStagingPath(targetDir, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(file));
  fs.writeFileSync(file, content, "utf-8");
}
