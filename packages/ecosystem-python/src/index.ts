import {
  type EcosystemRegistration,
  registerRecipe,
  registerTemplate,
  setManifestAdapter,
} from "@zealakit/core/ecosystem";
import { pythonManifestAdapter } from "./manifest/adapter.js";
import { RECIPE_LIST } from "./registry/recipes/index.js";
import { templateList } from "./registry/templates.js";

let registered = false;

/** Register Python templates, recipes and the pyproject.toml manifest adapter with core. */
export function registerPythonEcosystem(): void {
  if (registered) return;
  setManifestAdapter("python", pythonManifestAdapter);
  for (const template of templateList) {
    registerTemplate(template);
  }
  for (const recipe of RECIPE_LIST) {
    registerRecipe(recipe);
  }
  registered = true;
}

/** Explicit registration handle for programmatic consumers (`createZealakit`). */
export const pythonEcosystem: EcosystemRegistration = {
  id: "python",
  register: registerPythonEcosystem,
};

export { detectPythonEnvironment, type PythonEnvironmentReport } from "./detect.js";
export { pythonManifestAdapter } from "./manifest/adapter.js";
export { defineRecipe } from "./registry/recipes/define.js";
export { RECIPE_LIST } from "./registry/recipes/index.js";
export { templateList } from "./registry/templates.js";
export { isValidPythonProjectName } from "./validation/project-name.js";
