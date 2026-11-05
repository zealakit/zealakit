import type { ScaffoldConfig, ValidationResult } from "../types.js";

export type ManifestFieldConflict = {
  field: "dependencies" | "devDependencies" | "scripts";
  key: string;
  left: { recipeId: string; value: string };
  right: { recipeId: string; value: string };
};

/** Ecosystem-agnostic name kept as PackagePlan for existing call sites / preview. */
export type PackagePlan = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  addedDependencies: string[];
  addedDevDependencies: string[];
  addedScripts: string[];
  conflicts: ManifestFieldConflict[];
};

export type ManifestAdapter = {
  planMerges(config: ScaffoldConfig): PackagePlan;
  applyMerges(targetDir: string, config: ScaffoldConfig): void;
  validateProjectName(name: string): ValidationResult;
};

let adapter: ManifestAdapter | undefined;

export function setManifestAdapter(next: ManifestAdapter): void {
  adapter = next;
}

export function getManifestAdapter(): ManifestAdapter {
  if (!adapter) {
    throw new Error(
      "No manifest adapter registered. Call registerTypescriptEcosystem() (or another ecosystem) before scaffolding.",
    );
  }
  return adapter;
}

export function emptyPackagePlan(): PackagePlan {
  return {
    dependencies: {},
    devDependencies: {},
    scripts: {},
    addedDependencies: [],
    addedDevDependencies: [],
    addedScripts: [],
    conflicts: [],
  };
}
