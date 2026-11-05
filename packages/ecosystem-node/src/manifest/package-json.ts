import fs from "node:fs";
import path from "node:path";
import { getRecipe, getTemplateOverlayId, type ScaffoldConfig } from "@zealakit/core";

type PackageJson = {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

function merge(
  base: Record<string, string> | undefined,
  ...additions: (Record<string, string> | undefined)[]
): Record<string, string> {
  return Object.assign({}, base, ...additions);
}

export function mergePackageJson(targetDir: string, config: ScaffoldConfig): void {
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found in template at ${targetDir}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;
  const overlayId = getTemplateOverlayId(config.templateId);
  packageJson.name = config.projectName;

  for (const recipeId of config.recipeIds) {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      continue;
    }

    packageJson.dependencies = merge(
      packageJson.dependencies,
      recipe.packages,
      recipe.overlayPackages?.[overlayId],
    );
    packageJson.devDependencies = merge(
      packageJson.devDependencies,
      recipe.devDependencies,
      recipe.overlayDevDependencies?.[overlayId],
    );
    packageJson.scripts = merge(packageJson.scripts, recipe.scripts);
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf-8");
}
