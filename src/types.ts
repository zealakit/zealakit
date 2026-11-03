import type { FRAMEWORKS, RECIPE_CATEGORIES, SCOPES } from "./constants.js";

export type Scope = (typeof SCOPES)[number];
export type Framework = (typeof FRAMEWORKS)[number];
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export type TemplateConfig = {
  id: string;
  name: string;
  /** Label shown in the interactive template picker */
  label: string;
  scope: Scope;
  /** UI framework; omit for server templates */
  framework?: Framework;
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
   * UI frameworks this recipe targets (e.g. Zustand → react).
   * Omit for framework-agnostic recipes (linters, fetchers, ORMs, Storybook).
   */
  frameworks?: Framework[];
  /**
   * Only one exclusive recipe may be selected per shared category.
   * Non-exclusive recipes (e.g. Storybook) can sit beside exclusive UI kits.
   */
  exclusive?: boolean;
  /** Always applied for matching template scopes (not shown in prompts) */
  default?: boolean;
  packages: Record<string, string>;
  /** Extra packages merged for a specific overlay family (e.g. `next`, `vite-react`) */
  overlayPackages?: Record<string, Record<string, string>>;
  /** Extra devDependencies merged for a specific overlay family */
  overlayDevDependencies?: Record<string, Record<string, string>>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  /** Regex replacements applied per overlay (or template id) after the recipe overlay is copied */
  fileTransforms?: Record<string, RecipeFileTransform[]>;
  /** Runs once after every recipe has been copied, before package.json is merged */
  finalize?: (targetDir: string) => void;
};

export type ScaffoldConfig = {
  projectName: string;
  templateId: string;
  recipeIds: string[];
};

export type CliOptions = {
  projectName?: string;
  template?: string;
  with?: string;
  yes?: boolean;
  info?: boolean;
  json?: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
