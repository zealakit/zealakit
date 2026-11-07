import type { RecipeConfig } from "@zealakit/core";
import antd from "./antd.js";
import axios from "./axios.js";
import biome from "./biome.js";
import clientSharedPieces from "./client-shared-pieces.js";
import drizzleOrm from "./drizzle-orm.js";
import eslint from "./eslint.js";
import hookformZod from "./hookform-zod.js";
import kyjs from "./kyjs.js";
import mikroOrm from "./mikro-orm.js";
import mui from "./mui.js";
import nanostores from "./nanostores.js";
import nuxtUi from "./nuxt-ui.js";
import pinia from "./pinia.js";
import prisma from "./prisma.js";
import shadcnUi from "./shadcn-ui.js";
import shadcnVue from "./shadcn-vue.js";
import storybook from "./storybook.js";
import typeOrm from "./type-orm.js";
import veeValidateZod from "./vee-validate-zod.js";
import zustand from "./zustand.js";

/** Registration order = prompt option order. One module per recipe: `./<id>.ts`. */
export const RECIPE_LIST: RecipeConfig[] = [
  biome,
  eslint,
  zustand,
  pinia,
  nanostores,
  clientSharedPieces,
  hookformZod,
  veeValidateZod,
  kyjs,
  axios,
  antd,
  mui,
  shadcnUi,
  nuxtUi,
  shadcnVue,
  storybook,
  typeOrm,
  mikroOrm,
  drizzleOrm,
  prisma,
];

/** Local map for monitor / tooling before (or alongside) core registration. */
export const recipes: Record<string, RecipeConfig> = Object.fromEntries(
  RECIPE_LIST.map((recipe) => [recipe.id, recipe]),
);
