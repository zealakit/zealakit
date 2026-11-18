import type { RecipeConfig } from "@zealakit/core/ecosystem";
import dockerGo from "./docker-go.js";
import githubActionsGo from "./github-actions-go.js";
import mongodb from "./mongodb.js";
import mysql from "./mysql.js";
import postgres from "./postgres.js";

/** Registration order is prompt / Info order. */
export const RECIPE_LIST: RecipeConfig[] = [postgres, mysql, mongodb, dockerGo, githubActionsGo];

/** Local map for tooling that runs before ecosystem registration. */
export const recipes: Record<string, RecipeConfig> = Object.fromEntries(
  RECIPE_LIST.map((recipe) => [recipe.id, recipe]),
);
