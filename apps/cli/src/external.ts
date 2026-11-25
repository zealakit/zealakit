import path from "node:path";

import {
  getRecipe,
  isExternalRecipeSpec,
  type RecipeConfig,
  readProjectManifest,
  registerRecipe,
  resolveExternalRecipe,
} from "@zealakit/core/internal";
import pc from "picocolors";

import { userConfigDir } from "./presets.js";

export type ExternalLoad = { recipes: RecipeConfig[]; errors: string[] };

/** Where downloaded GitHub recipes are cached. */
export function externalCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(userConfigDir(env), "recipes");
}

/** Register a loaded external recipe; built-in ids can never be replaced. */
function register(recipe: RecipeConfig, errors: string[]): void {
  const existing = getRecipe(recipe.id);
  if (existing && !existing.external) {
    errors.push(
      `External recipe id '${recipe.id}' collides with a built-in recipe; rename it in recipe.json.`,
    );
    return;
  }
  registerRecipe(recipe);
}

/** Resolve every external spec (path or github:), register the recipes, report errors. */
export async function loadExternalSpecs(specs: string[], cwd: string): Promise<ExternalLoad> {
  const recipes: RecipeConfig[] = [];
  const errors: string[] = [];
  for (const spec of specs) {
    const resolved = await resolveExternalRecipe(spec, { cwd, cacheDir: externalCacheDir() });
    if (!resolved.ok) {
      errors.push(...resolved.errors.map((message) => `${spec}: ${message}`));
      continue;
    }
    register(resolved.recipe, errors);
    recipes.push(resolved.recipe);
  }
  return { recipes, errors };
}

/**
 * Re-register the external recipes a project was generated with (pinned to the
 * recorded commit for GitHub sources) so `add` / `doctor` / `outdated` can plan.
 */
export async function loadProjectExternals(projectDir: string): Promise<ExternalLoad> {
  const loaded = readProjectManifest(projectDir);
  if (!loaded?.ok || !loaded.manifest.externalRecipes) return { recipes: [], errors: [] };
  const specs = loaded.manifest.externalRecipes.map((item) =>
    item.sha && item.source.startsWith("github:")
      ? `${item.source.split("#")[0]}#${item.sha}`
      : item.source,
  );
  return loadExternalSpecs(specs, projectDir);
}

/** Split a `-w` list into built-in ids and external specs. */
export function splitRecipeList(ids: string[]): { builtin: string[]; external: string[] } {
  return {
    builtin: ids.filter((id) => !isExternalRecipeSpec(id)),
    external: ids.filter((id) => isExternalRecipeSpec(id)),
  };
}

/** Human summary shown before anything external is applied. */
export function describeExternals(recipes: RecipeConfig[]): string {
  const lines = [pc.yellow(pc.bold("External recipes (untrusted, data only — no code runs)"))];
  for (const recipe of recipes) {
    const info = recipe.external;
    lines.push(
      `  ${pc.cyan(recipe.id)}  ${info?.source ?? ""}${info?.sha ? `  @ ${info.sha}` : ""}`,
      pc.dim(
        `    adds files, package merges and text transforms only; ${Object.keys(recipe.fileTransforms ?? {}).length} transform group(s)`,
      ),
    );
  }
  return lines.join("\n");
}
