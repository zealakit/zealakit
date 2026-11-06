import { getRecipeCategories, recipes } from "../registry/index.js";
import type { RuleMetadata } from "./types.js";

/**
 * Static compatibility rules derived from the registry. Shared by `info`,
 * external JSON consumers, and documentation tooling.
 *
 * `visibleRecipeIds` restricts referenced recipe ids so filtered responses never
 * point at entities that were filtered out.
 */
export function getRuleMetadata(visibleRecipeIds?: ReadonlySet<string>): RuleMetadata[] {
  const all = Object.values(recipes);
  const visible = (recipeId: string): boolean =>
    visibleRecipeIds === undefined || visibleRecipeIds.has(recipeId);
  const ids = (list: typeof all): string[] =>
    list.map((recipe) => recipe.id).filter((id) => visible(id));

  return [
    {
      id: "scope-match",
      description:
        "A recipe applies only to templates whose scope is listed in supportedScopes (strict: hybrid does not accept server-only recipes).",
    },
    {
      id: "hybrid-orm-caveat",
      description:
        "ORM recipes also support hybrid (Next, Nuxt, etc.) as best-effort for small apps; interactive prompts and dry-run warn that a dedicated backend framework is preferred for production APIs.",
      recipes: ids(all.filter((recipe) => getRecipeCategories(recipe).includes("orm"))),
    },
    {
      id: "ui-framework-match",
      description:
        "A recipe with uiFrameworks applies only to templates using one of them; uiFrameworks null means UI-framework-agnostic.",
    },
    {
      id: "overlay-required",
      description:
        "A recipe that ships overlays must have an overlay for the template's overlay id.",
    },
    {
      id: "exclusive-per-category",
      description: "At most one exclusive recipe may be selected per category.",
      recipes: ids(all.filter((recipe) => recipe.exclusive)),
    },
    {
      id: "non-exclusive-coexist",
      description:
        "Non-exclusive recipes can be combined with any exclusive pick in the same category.",
      recipes: ids(all.filter((recipe) => !recipe.exclusive && !recipe.default)),
    },
    {
      id: "default-recipes",
      description:
        "Injected automatically (prepended) for every template whose scope they support; never prompted.",
      recipes: ids(all.filter((recipe) => recipe.default)),
    },
    {
      id: "recipe-dependencies",
      description:
        "Recipes may declare dependsOn; transitive deps are auto-injected before write, cycles and missing ids fail preflight.",
      recipes: ids(all.filter((recipe) => (recipe.dependsOn?.length ?? 0) > 0)),
    },
  ];
}
