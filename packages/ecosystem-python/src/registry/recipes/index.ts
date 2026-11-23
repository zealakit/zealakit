import type { RecipeConfig } from "@zealakit/core/ecosystem";
import alembic from "./alembic.js";
import dockerPython from "./docker-python.js";
import docsPython from "./docs-python.js";
import githubActionsPython from "./github-actions-python.js";
import postgresPython from "./postgres-python.js";
import sqlalchemy from "./sqlalchemy.js";

/** Registration order is prompt / Info order. */
export const RECIPE_LIST: RecipeConfig[] = [
  sqlalchemy,
  alembic,
  postgresPython,
  dockerPython,
  docsPython,
  githubActionsPython,
];
