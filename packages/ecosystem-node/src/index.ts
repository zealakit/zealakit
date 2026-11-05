import { registerRecipe, registerTemplate, setManifestAdapter } from "@zealakit/core";
import { nodeManifestAdapter } from "./manifest/adapter.js";
import { RECIPE_LIST } from "./registry/recipes/index.js";
import { templateList } from "./registry/templates.js";

let registered = false;

/** Register Node templates, recipes, and the npm manifest adapter with core. */
export function registerNodeEcosystem(): void {
  if (registered) return;
  setManifestAdapter("node", nodeManifestAdapter);
  for (const template of templateList) {
    registerTemplate(template);
  }
  for (const recipe of RECIPE_LIST) {
    registerRecipe(recipe);
  }
  registered = true;
}

export {
  appendExport,
  defineRecipe,
  ENABLE_TS_DECORATORS,
  nextUiProviders,
  nuxtConfigKeys,
  nuxtModule,
  serverOrmWiring,
  viteReactAppProvider,
} from "./registry/recipes/define.js";
export { RECIPE_LIST, recipes } from "./registry/recipes/index.js";
export { templateList } from "./registry/templates.js";
export { isValidNpmPackageName, validateProjectName } from "./validation/project-name.js";
