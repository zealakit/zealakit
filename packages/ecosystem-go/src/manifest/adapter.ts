import fs from "node:fs";
import path from "node:path";
import {
  emptyPackagePlan,
  type ManifestAdapter,
  type PackagePlan,
  type ScaffoldConfig,
  type ValidationResult,
} from "@zealakit/core";
import { isValidGoProjectName } from "../validation/project-name.js";

function modulePathForProject(projectName: string): string {
  return projectName.includes(".") ? projectName : `example.com/${projectName}`;
}

/** Read the `module` path from go.mod contents. */
export function readGoModulePath(goMod: string): string | undefined {
  const match = /^module\s+(\S+)/m.exec(goMod);
  return match?.[1];
}

function rewriteGoSources(targetDir: string, fromModule: string, toModule: string): void {
  if (fromModule === toModule) return;

  const stack = [targetDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "vendor" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".go") && entry.name !== "go.mod") continue;
      const original = fs.readFileSync(full, "utf-8");
      if (!original.includes(fromModule)) continue;
      fs.writeFileSync(full, original.split(fromModule).join(toModule), "utf-8");
    }
  }
}

function applyGoModuleRewrite(targetDir: string, projectName: string): void {
  const goModPath = path.join(targetDir, "go.mod");
  if (!fs.existsSync(goModPath)) {
    throw new Error(`go.mod not found in template at ${targetDir}`);
  }

  const goMod = fs.readFileSync(goModPath, "utf-8");
  const fromModule = readGoModulePath(goMod);
  if (!fromModule) {
    throw new Error("go.mod is missing a module declaration.");
  }

  const modulePath = modulePathForProject(projectName);
  rewriteGoSources(targetDir, fromModule, modulePath);

  const rewritten = fs.readFileSync(goModPath, "utf-8");
  if (!/^module\s+\S+/m.test(rewritten)) {
    throw new Error("go.mod is missing a module declaration after rewrite.");
  }
}

export const goManifestAdapter: ManifestAdapter = {
  planMerges(_config: ScaffoldConfig): PackagePlan {
    return emptyPackagePlan();
  },
  applyMerges(targetDir: string, config: ScaffoldConfig): void {
    applyGoModuleRewrite(targetDir, config.projectName);
  },
  validateProjectName(name: string): ValidationResult {
    if (!name.trim()) {
      return { valid: false, errors: ["Project name cannot be empty."] };
    }
    if (!isValidGoProjectName(name)) {
      return {
        valid: false,
        errors: [
          `Project name "${name}" is invalid. Use a lowercase directory/module segment (letters, digits, hyphens, underscores, dots, and optional path segments).`,
        ],
      };
    }
    return { valid: true, errors: [] };
  },
};
