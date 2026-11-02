export const SCOPES = ["client", "server", "hybrid", "infrastructure"] as const;

export const RECIPE_CATEGORIES = [
  "linter",
  "state",
  "ui",
  "ui-react",
  "ui-vue",
  "ui-svelte",
  "form",
  "fetcher",
  "orm",
  "infrastructure",
  "utils",
  "testing",
  "documentation",
] as const;

/** Framework-specific UI tags (subset of RECIPE_CATEGORIES). Shared kits stay on plain `ui`. */
export const UI_FRAMEWORK_CATEGORIES = ["ui-react", "ui-vue", "ui-svelte"] as const;
