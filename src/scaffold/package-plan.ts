import { getRecipe, getTemplateOverlayId } from "../registry/index.js";
import type { ScaffoldConfig } from "../types.js";

export type PackageFieldConflict = {
  field: "dependencies" | "devDependencies" | "scripts";
  key: string;
  left: { recipeId: string; value: string };
  right: { recipeId: string; value: string };
};

export type PackagePlan = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  /** Packages / scripts newly introduced by recipes (vs empty base) */
  addedDependencies: string[];
  addedDevDependencies: string[];
  addedScripts: string[];
  conflicts: PackageFieldConflict[];
};

function mergeField(
  field: PackageFieldConflict["field"],
  conflicts: PackageFieldConflict[],
  owners: Map<string, { recipeId: string; value: string }>,
  target: Record<string, string>,
  recipeId: string,
  additions: Record<string, string> | undefined,
): void {
  if (!additions) return;
  for (const [key, value] of Object.entries(additions)) {
    const existing = owners.get(key);
    if (existing && existing.value !== value) {
      conflicts.push({
        field,
        key,
        left: existing,
        right: { recipeId, value },
      });
    }
    owners.set(key, { recipeId, value });
    target[key] = value;
  }
}

/** Pure merge of recipe package/script contributions with conflict detection. */
export function planPackageMerges(config: ScaffoldConfig): PackagePlan {
  const overlayId = getTemplateOverlayId(config.templateId);
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const scripts: Record<string, string> = {};
  const conflicts: PackageFieldConflict[] = [];
  const depOwners = new Map<string, { recipeId: string; value: string }>();
  const devOwners = new Map<string, { recipeId: string; value: string }>();
  const scriptOwners = new Map<string, { recipeId: string; value: string }>();

  for (const recipeId of config.recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) continue;
    mergeField("dependencies", conflicts, depOwners, dependencies, recipeId, recipe.packages);
    mergeField(
      "dependencies",
      conflicts,
      depOwners,
      dependencies,
      recipeId,
      recipe.overlayPackages?.[overlayId],
    );
    mergeField(
      "devDependencies",
      conflicts,
      devOwners,
      devDependencies,
      recipeId,
      recipe.devDependencies,
    );
    mergeField(
      "devDependencies",
      conflicts,
      devOwners,
      devDependencies,
      recipeId,
      recipe.overlayDevDependencies?.[overlayId],
    );
    mergeField("scripts", conflicts, scriptOwners, scripts, recipeId, recipe.scripts);
  }

  return {
    dependencies,
    devDependencies,
    scripts,
    addedDependencies: Object.keys(dependencies).sort(),
    addedDevDependencies: Object.keys(devDependencies).sort(),
    addedScripts: Object.keys(scripts).sort(),
    conflicts,
  };
}
