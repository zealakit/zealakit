import {
  getTemplate,
  getTemplateDevCommand,
  type ManifestAdapter,
  type NextSteps,
  type PackagePlan,
  type ScaffoldConfig,
  type ValidationResult,
} from "@zealakit/core/ecosystem";
import { validateNpmOutput } from "../validation/output.js";
import { validateProjectName } from "../validation/project-name.js";
import { mergePackageJson } from "./package-json.js";
import { planPackageMerges } from "./package-plan.js";

export const nodeManifestAdapter: ManifestAdapter = {
  planMerges(config: ScaffoldConfig): PackagePlan {
    return planPackageMerges(config);
  },
  applyMerges(targetDir: string, config: ScaffoldConfig): void {
    mergePackageJson(targetDir, config);
  },
  validateProjectName(name: string): ValidationResult {
    return validateProjectName(name);
  },
  validateOutput(targetDir: string, config: ScaffoldConfig): string[] {
    return validateNpmOutput(targetDir, config);
  },
  nextSteps(config: ScaffoldConfig): NextSteps {
    const template = getTemplate(config.templateId);
    const devCommand = template ? getTemplateDevCommand(template) : "npm run dev";
    return { commands: ["npm install", devCommand] };
  },
};
