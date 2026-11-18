import type { PackageManager } from "../package-manager.js";
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

/** What the user should run after `cd <project>`. */
export type NextSteps = {
  commands: string[];
  /** Optional dim hint printed after the commands. */
  tip?: string;
};

export type PostGenerateOptions = {
  packageManager: PackageManager;
  /** Install dependencies (npm install, go mod tidy, …). */
  install: boolean;
};

export type PostGenerateResult = {
  install: "skipped" | "ok" | "failed";
  /** Human-readable detail (failure reason, skipped reason). */
  message?: string;
};

export type NextStepsOptions = {
  packageManager: PackageManager;
  /** Dependencies were already installed by `postGenerate`. */
  installed: boolean;
};

export type ManifestAdapter = {
  planMerges(config: ScaffoldConfig): PackagePlan;
  applyMerges(targetDir: string, config: ScaffoldConfig): void;
  validateProjectName(name: string): ValidationResult;
  /** Ecosystem-specific structural checks on the generated project; returns error messages. */
  validateOutput(targetDir: string, config: ScaffoldConfig): string[];
  /**
   * Optional steps after the project is committed (set `packageManager`,
   * install). Must not throw for expected failures: report `failed` instead.
   */
  postGenerate?(
    targetDir: string,
    config: ScaffoldConfig,
    options: PostGenerateOptions,
  ): Promise<PostGenerateResult>;
  /** Commands shown after a successful scaffold. */
  nextSteps(config: ScaffoldConfig, options: NextStepsOptions): NextSteps;
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
