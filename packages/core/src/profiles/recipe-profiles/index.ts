import type { RecipeProfile } from "../types.js";

/**
 * Discovery profiles for every registered recipe.
 * Category / scopes / UI frameworks / dependsOn / exclusivity live on `RecipeConfig`.
 */
export const RECIPE_PROFILES: readonly RecipeProfile[] = [
  {
    id: "biome",
    capabilities: [],
    alwaysRelevant: true,
  },
  {
    id: "eslint",
    capabilities: [],
    alwaysRelevant: true,
  },
  {
    id: "zustand",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "pinia",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "nanostores",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "client-shared-pieces",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "hookform-zod",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "vee-validate-zod",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "kyjs",
    capabilities: ["external-api"],
    projectTypes: ["ui"],
  },
  {
    id: "axios",
    capabilities: ["external-api"],
    projectTypes: ["ui"],
  },
  {
    id: "antd",
    capabilities: ["web-ui"],
    projectTypes: ["ui"],
  },
  {
    id: "mui",
    capabilities: ["web-ui"],
    projectTypes: ["ui"],
  },
  {
    id: "shadcn-ui",
    capabilities: ["web-ui"],
    projectTypes: ["ui"],
  },
  {
    id: "nuxt-ui",
    capabilities: ["web-ui"],
    projectTypes: ["ui"],
  },
  {
    id: "shadcn-vue",
    capabilities: ["web-ui"],
    projectTypes: ["ui"],
  },
  {
    id: "storybook",
    capabilities: [],
    projectTypes: ["ui"],
  },
  {
    id: "type-orm",
    capabilities: ["database"],
    // `ui` covers hybrid templates (Next, Nuxt, Astro hybrid); compat still
    // requires a server/hybrid scope and a matching overlay.
    projectTypes: ["server-api", "ui"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "mikro-orm",
    capabilities: ["database"],
    // `ui` covers hybrid templates (Next, Nuxt, Astro hybrid); compat still
    // requires a server/hybrid scope and a matching overlay.
    projectTypes: ["server-api", "ui"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "drizzle-orm",
    capabilities: ["database"],
    // `ui` covers hybrid templates (Next, Nuxt, Astro hybrid); compat still
    // requires a server/hybrid scope and a matching overlay.
    projectTypes: ["server-api", "ui"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
  {
    id: "prisma",
    capabilities: ["database"],
    // `ui` covers hybrid templates (Next, Nuxt, Astro hybrid); compat still
    // requires a server/hybrid scope and a matching overlay.
    projectTypes: ["server-api", "ui"],
    databases: ["postgresql", "mysql", "sqlite"],
  },
];
