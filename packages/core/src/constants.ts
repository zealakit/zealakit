export const SCOPES = ["client", "server", "hybrid", "infrastructure"] as const;

/** UI frameworks a template is built on. Server templates have none. */
export const FRAMEWORKS = ["react", "vue", "svelte"] as const;

export const RECIPE_CATEGORIES = [
  "linter",
  "state",
  "ui",
  "form",
  "fetcher",
  "orm",
  "infrastructure",
  "utils",
  "testing",
  "documentation",
] as const;
