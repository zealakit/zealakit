import {
  type EcosystemRegistration,
  registerRecipe,
  registerTemplate,
  setManifestAdapter,
} from "@zealakit/core";
import { goManifestAdapter } from "./manifest/adapter.js";
import { RECIPE_LIST } from "./registry/recipes/index.js";
import { templateList } from "./registry/templates.js";

let registered = false;

/** Register Go templates and the go.mod manifest adapter with core. */
export function registerGoEcosystem(): void {
  if (registered) return;
  setManifestAdapter("go", goManifestAdapter);
  for (const template of templateList) {
    registerTemplate(template);
  }
  for (const recipe of RECIPE_LIST) {
    registerRecipe(recipe);
  }
  registered = true;
}

/** Explicit registration handle for programmatic consumers (`createZealakit`). */
export const goEcosystem: EcosystemRegistration = {
  id: "go",
  register: registerGoEcosystem,
};

export { detectGoEnvironment } from "./detect.js";
export { goManifestAdapter, readGoModulePath } from "./manifest/adapter.js";
export { defineGoRecipe } from "./registry/recipes/define.js";
export { RECIPE_LIST, recipes } from "./registry/recipes/index.js";
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
