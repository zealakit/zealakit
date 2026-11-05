import type { RecipeCategory, Scope, UiFramework } from "./constants.js";

export type { RecipeCategory, Scope, UiFramework };

/** Scaffolding ecosystem that owns templates/recipes and a ManifestAdapter. */
export type EcosystemId = "node" | "go";

export type TemplateConfig = {
  id: string;
  name: string;
  /** Label shown in the interactive template picker */
  label: string;
  scope: Scope;
  /** UI library from `UI_FRAMEWORKS`; omit for server / infrastructure templates */
  uiFramework?: UiFramework;
  description: string;
  path: string;
  /**
   * Recipe overlay folder under `recipes/<id>/overlays/`.
   * Defaults to `id`. Use a stable family id (e.g. `next`) when multiple
   * template versions should share the same recipe overlays.
   */
  overlay?: string;
  /**
   * App source root when it is not `src/` (Nuxt uses `app/`). Recipe `src/`
   * trees are folded into it after each recipe copy.
   */
  srcDir?: string;
  /** Command printed after scaffolding. Defaults to `npm run dev`. */
  devCommand?: string;
  /**
   * Owning ecosystem. Defaults to `node` when omitted (existing templates).
   * Selects the ManifestAdapter used during scaffold.
   */
  ecosystem?: EcosystemId;
};

export type RecipeFileTransform = {
  file: string;
  /** Regex replacement (mutually exclusive with `append`) */
  pattern?: RegExp;
  replacement?: string;
  /** Append this text if missing — does not overwrite existing content */
  append?: string;
};

export type RecipeConfig = {
  id: string;
  name: string;
  /** Short hint shown next to the recipe in prompts */
  hint?: string;
  /** One or more categories (e.g. Storybook: ui + testing + documentation). */
  category: RecipeCategory | RecipeCategory[];
  /** Scopes this recipe supports */
  supportedScopes: Scope[] | "all";
  /**
   * UI libraries this recipe targets (e.g. Zustand → react).
   * Omit for UI-agnostic recipes (linters, fetchers, ORMs, Storybook).
   */
  uiFrameworks?: UiFramework[];
  /**
   * Only one exclusive recipe may be selected per shared category.
   * Non-exclusive recipes (e.g. Storybook) can sit beside exclusive UI kits.
   */
  exclusive?: boolean;
  /** Always applied for matching template scopes (not shown in prompts) */
  default?: boolean;
  /**
   * Other recipe ids that must be applied with this one (transitive).
   * Missing / circular dependencies fail before any files are written.
   */
  dependsOn?: string[];
  /**
   * Directory under `recipes/` (e.g. `node/mui`). Defaults to `id` when omitted.
   */
  path?: string;
  /**
   * npm dependency contributions (Node ecosystem).
   * Kept on the shared recipe type for migration compatibility.
   */
  packages: Record<string, string>;
  /** Extra packages merged for a specific overlay family (e.g. `next`, `vite-react`) */
  overlayPackages?: Record<string, Record<string, string>>;
  /** Extra devDependencies merged for a specific overlay family */
  overlayDevDependencies?: Record<string, Record<string, string>>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  /** Regex replacements applied per overlay (or template id) after the recipe overlay is copied */
  fileTransforms?: Record<string, RecipeFileTransform[]>;
  /**
   * Optional post-copy hook (e.g. Nest Biome decorator flags). Prefer
   * `fileTransforms` when a regex/append is enough.
   */
  finalize?: (targetDir: string) => void;
};

export type ScaffoldConfig = {
  projectName: string;
  templateId: string;
  recipeIds: string[];
  targetDir?: string;
};

export type CliOptions = {
  projectName?: string;
  template?: string;
  with?: string;
  yes?: boolean;
  dryRun?: boolean;
  info?: boolean;
  json?: boolean;
  /** Enter Project Discovery mode (interactive recommendations). */
  discover?: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
