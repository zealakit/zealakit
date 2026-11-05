import type {
  ManifestAdapter,
  PackagePlan,
  ScaffoldConfig,
  ValidationResult,
} from "@zealakit/core";
import { validateProjectName } from "../validation/project-name.js";
import { mergePackageJson } from "./package-json.js";
import { planPackageMerges } from "./package-plan.js";

export const typescriptManifestAdapter: ManifestAdapter = {
  planMerges(config: ScaffoldConfig): PackagePlan {
    return planPackageMerges(config);
  },
  applyMerges(targetDir: string, config: ScaffoldConfig): void {
    mergePackageJson(targetDir, config);
  },
  validateProjectName(name: string): ValidationResult {
    return validateProjectName(name);
  },
};
