import type { RecipeProfile } from "../types.js";

/**
 * Discovery profiles for every registered recipe.
 * Category / scopes / UI frameworks / dependsOn / exclusivity live on `RecipeConfig`.
 */
export const RECIPE_PROFILES: readonly RecipeProfile[] = [
  {
    id: "biome",
    capabilities: [],
  },
  {
    id: "eslint",
    capabilities: [],
  },
  {
    id: "zustand",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "pinia",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "nanostores",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "client-shared-pieces",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "hookform-zod",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "vee-validate-zod",
    capabilities: [],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "kyjs",
    capabilities: ["external-api"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "axios",
    capabilities: ["external-api"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "antd",
    capabilities: ["web-ui"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "mui",
    capabilities: ["web-ui"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "shadcn-ui",
    capabilities: ["web-ui"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "nuxt-ui",
    capabilities: ["web-ui"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "shadcn-vue",
    capabilities: ["web-ui"],
    projectTypes: ["web-app", "fullstack", "website"],
  },
  {
    id: "storybook",
    capabilities: [],
    projectTypes: ["web-app", "website", "fullstack"],
  },
  {
    id: "type-orm",
    capabilities: ["database"],
    projectTypes: ["api", "fullstack"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "mikro-orm",
    capabilities: ["database"],
    projectTypes: ["api", "fullstack"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "drizzle-orm",
    capabilities: ["database"],
    projectTypes: ["api", "fullstack"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "prisma",
    capabilities: ["database"],
    projectTypes: ["api", "fullstack"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
];
