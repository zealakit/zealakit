import { getTemplate } from "../registry/index.js";
import type { EcosystemId, ScaffoldConfig, ValidationResult } from "../types.js";

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

const adapters = new Map<EcosystemId, ManifestAdapter>();

export function setManifestAdapter(ecosystem: EcosystemId, next: ManifestAdapter): void {
  adapters.set(ecosystem, next);
}

export function getManifestAdapter(ecosystem: EcosystemId = "node"): ManifestAdapter {
  const adapter = adapters.get(ecosystem);
  if (!adapter) {
    throw new Error(
      `No manifest adapter registered for ecosystem '${ecosystem}'. Call registerNodeEcosystem() / registerGoEcosystem() before scaffolding.`,
    );
  }
  return adapter;
}

export function resolveTemplateEcosystem(templateId: string): EcosystemId {
  return getTemplate(templateId)?.ecosystem ?? "node";
}

export function getManifestAdapterForConfig(config: ScaffoldConfig): ManifestAdapter {
  return getManifestAdapter(resolveTemplateEcosystem(config.templateId));
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
