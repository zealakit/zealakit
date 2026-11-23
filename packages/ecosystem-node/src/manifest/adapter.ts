import fs from "node:fs";
import path from "node:path";

import {
  adaptRunCommand,
  getTemplate,
  getTemplateDevCommand,
  installCommand,
  type ManifestAdapter,
  type NextSteps,
  type NextStepsOptions,
  type PackagePlan,
  type PostGenerateOptions,
  type PostGenerateResult,
  type ScaffoldConfig,
  type ValidationResult,
} from "@zealakit/core/ecosystem";

import { runCapture, runStreaming } from "../run-command.js";
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
  async postGenerate(
    targetDir: string,
    _config: ScaffoldConfig,
    options: PostGenerateOptions,
  ): Promise<PostGenerateResult> {
    const pm = options.packageManager;
    // npm records no `packageManager`; pnpm/yarn (corepack) do.
    if (pm === "pnpm" || pm === "yarn") {
      const version = runCapture(pm, ["--version"], targetDir);
      if (version.ok && /^\d+\.\d+\.\d+/.test(version.stdout)) {
        const file = path.join(targetDir, "package.json");
        const pkg = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
        pkg.packageManager = `${pm}@${version.stdout}`;
        fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
      }
    }
    if (!options.install) {
      return { install: "skipped" };
    }
    const result = runStreaming(pm, ["install"], targetDir);
    return result.ok ? { install: "ok" } : { install: "failed", message: result.message };
  },
  nextSteps(config: ScaffoldConfig, options: NextStepsOptions): NextSteps {
    const template = getTemplate(config.templateId);
    const devCommand = adaptRunCommand(
      template ? getTemplateDevCommand(template) : "npm run dev",
      options.packageManager,
    );
    return {
      commands: options.installed
        ? [devCommand]
        : [installCommand(options.packageManager), devCommand],
    };
  },
};
