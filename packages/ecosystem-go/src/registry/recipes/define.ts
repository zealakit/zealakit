import type { RecipeConfig } from "@zealakit/core/ecosystem";

export type GoRecipeInput = Omit<RecipeConfig, "manifest"> & {
  goModules?: Record<string, string>;
};

/** Typed Go recipe modules; `goModules` is folded into `manifest`. */
export function defineGoRecipe(input: GoRecipeInput): RecipeConfig {
  const { goModules, ...rest } = input;
  return {
    ...rest,
    path: rest.path ?? `go/${rest.id}`,
    ecosystem: rest.ecosystem ?? "go",
    manifest: { ecosystem: "go", goModules: goModules ?? {} },
  };
}
