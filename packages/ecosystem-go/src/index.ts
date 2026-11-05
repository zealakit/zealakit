import { registerTemplate, setManifestAdapter } from "@zealakit/core";
import { goManifestAdapter } from "./manifest/adapter.js";
import { templateList } from "./registry/templates.js";

let registered = false;

/** Register Go templates and the go.mod manifest adapter with core. */
export function registerGoEcosystem(): void {
  if (registered) return;
  setManifestAdapter("go", goManifestAdapter);
  for (const template of templateList) {
    registerTemplate(template);
  }
  registered = true;
}

export { detectGoEnvironment } from "./detect.js";
export { goManifestAdapter, readGoModulePath } from "./manifest/adapter.js";
export { templateList } from "./registry/templates.js";
export { resolveGoExecutable } from "./resolve-executable.js";
export { defaultRunCommand } from "./run-command.js";
export type {
  DetectGoEnvironmentOptions,
  GoEnvironmentIssue,
  GoEnvironmentReport,
  RunCommand,
  RunCommandResult,
  ToolchainStatus,
} from "./types.js";
export { isValidGoProjectName } from "./validation/project-name.js";
export {
  compareGoVersions,
  extractGoVersionLabel,
  formatGoSemVer,
  type GoSemVer,
  parseGoVersion,
  satisfiesMinimumGoVersion,
} from "./version.js";
