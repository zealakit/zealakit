import type { PythonRecipeManifest, RecipeConfig } from "@zealakit/core/ecosystem";

const PYTHON_RECIPE_PREFIX = "python/";

/** Authoring shape: dependencies stay flat; `defineRecipe` folds them into `manifest`. */
export type PythonRecipeInput = Omit<RecipeConfig, "manifest"> &
  Partial<Omit<PythonRecipeManifest, "ecosystem">>;

export function defineRecipe(input: PythonRecipeInput): RecipeConfig {
  const { dependencies, devDependencies, ...rest } = input;
  return {
    ...rest,
    path: rest.path ?? `${PYTHON_RECIPE_PREFIX}${rest.id}`,
    ecosystem: "python",
    manifest: {
      ecosystem: "python",
      dependencies: dependencies ?? {},
      devDependencies: devDependencies ?? {},
    },
  };
}
