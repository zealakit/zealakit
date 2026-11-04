import {
  circularDependencyDiagnostic,
  formatDiagnostic,
  missingDependencyDiagnostic,
} from "./diagnostics.js";
import { getAllRecipeIds, getRecipe } from "./registry/index.js";
import type { RecipeConfig } from "./types.js";

export type RecipeResolveError =
  | { code: "missing"; recipeId: string; requiredBy: string }
  | { code: "cycle"; cycle: string[] };

export type RecipeResolveResult =
  | {
      ok: true;
      /** Apply order: dependencies before dependents; otherwise preserves selection order */
      recipeIds: string[];
      /** Selected by the user (after defaults), excluding transitive deps */
      selectedIds: string[];
      /** Transitive dependencies pulled in automatically */
      autoInjected: string[];
    }
  | { ok: false; error: RecipeResolveError };

type Lookup = (id: string) => RecipeConfig | undefined;

/**
 * Expand `dependsOn` transitively, detect cycles / missing ids, dedupe, and
 * return a deterministic order: dependency-first DFS over the selection order
 * (stable; does not reshuffle unrelated recipes by registry position).
 */
export function resolveRecipeDependencies(
  selectedIds: string[],
  lookup: Lookup = getRecipe,
  _registryOrder: string[] = getAllRecipeIds(),
): RecipeResolveResult {
  const selected = [...new Set(selectedIds)];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const ordered: string[] = [];
  const requiredBy = new Map<string, string>();

  function visit(id: string, from: string | undefined): RecipeResolveError | undefined {
    const recipe = lookup(id);
    if (!recipe) {
      return { code: "missing", recipeId: id, requiredBy: from ?? id };
    }
    if (visited.has(id)) {
      return undefined;
    }
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return { code: "cycle", cycle: [...stack.slice(start), id] };
    }

    visiting.add(id);
    stack.push(id);
    for (const dep of recipe.dependsOn ?? []) {
      if (!requiredBy.has(dep) && !selected.includes(dep)) {
        requiredBy.set(dep, id);
      }
      const error = visit(dep, id);
      if (error) {
        return error;
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
    return undefined;
  }

  for (const id of selected) {
    const error = visit(id, undefined);
    if (error) {
      return { ok: false, error };
    }
  }

  const selectedSet = new Set(selected);
  return {
    ok: true,
    recipeIds: ordered,
    selectedIds: selected,
    autoInjected: ordered.filter((id) => !selectedSet.has(id)),
  };
}

export function formatRecipeResolveError(error: RecipeResolveError): string {
  if (error.code === "missing") {
    return formatDiagnostic(missingDependencyDiagnostic(error.recipeId, error.requiredBy));
  }
  return formatDiagnostic(circularDependencyDiagnostic(error.cycle));
}
