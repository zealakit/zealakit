import type { EcosystemId, RecipeCategory, Scope, UiFramework } from "./constants.js";
import type { PackageManager } from "./package-manager.js";
import type { RecipeProfile, TemplateProfile } from "./profiles/types.js";

export type { EcosystemId, RecipeCategory, Scope, UiFramework };

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
  /** Discovery metadata (authored next to the template; `id` is implied). */
  discovery?: Omit<TemplateProfile, "id">;
};

export type RecipeFileTransform = {
  /** Path relative to the staging root; may not escape it (traversal is rejected). */
  file: string;
  /** Regex replacement (mutually exclusive with `append`) */
  pattern?: RegExp;
  replacement?: string;
  /** Append this text if missing — does not overwrite existing content */
  append?: string;
  /**
   * Insert `insert` on its own line(s) next to the line containing `marker`
   * (e.g. `// zealakit-modules`), matching that line's indentation. Prefer this
   * over a regex: template drift outside the marker cannot break it.
   */
  marker?: string;
  insert?: string;
  /** Where to insert relative to the marker line (default `after`). */
  position?: "after" | "before";
  /**
   * Structural JSON edit: receives the parsed document and mutates it. Use for
   * `*.json` files instead of regexes against formatting.
   */
  json?: (data: Record<string, unknown>) => void;
};

/** npm contributions (Node ecosystem). */
export type NpmRecipeManifest = {
  ecosystem: "node";
  packages: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  /** Extra packages merged for a specific overlay family (e.g. `next`, `vite-react`) */
  overlayPackages?: Record<string, Record<string, string>>;
  /** Extra devDependencies merged for a specific overlay family */
  overlayDevDependencies?: Record<string, Record<string, string>>;
};

/** Go module requirements (module path → version) for Go recipes. */
export type GoRecipeManifest = {
  ecosystem: "go";
  goModules: Record<string, string>;
};

export type RecipeManifest = NpmRecipeManifest | GoRecipeManifest;

/** What a recipe `finalize` hook can see besides the staging directory. */
export type FinalizeContext = {
  /** The effective scaffold config (all recipes, defaults and dependencies included). */
  config: ScaffoldConfig;
};

/** Provenance of a recipe loaded from outside the kit (data-only: no code runs). */
export type ExternalRecipeInfo = {
  /** What the user typed (`./path` or `github:owner/repo/path#ref`). */
  source: string;
  /** Git ref requested, when any. */
  ref?: string;
  /** Resolved commit SHA for GitHub sources. */
  sha?: string;
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
   * At least one of these recipes must also be selected (e.g. a migration tool
   * needs one of several database recipes). Unlike `dependsOn` nothing is
   * auto-added: the user picks which one.
   */
  requiresAnyOf?: string[];
  /**
   * Directory under `recipes/` (e.g. `node/mui`). Defaults to `id` when omitted.
   */
  path?: string;
  /**
   * Owning ecosystem. Defaults to `node` (set by `defineRecipe`) and falls back
   * to the `recipes/<ecosystem>/` path prefix for unregistered configs.
   */
  ecosystem?: EcosystemId;
  /** Set for recipes loaded from `recipe.json` outside the kit. */
  external?: ExternalRecipeInfo;
  /** Discovery metadata (authored next to the recipe; `id` is implied). */
  discovery?: Omit<RecipeProfile, "id">;
  /** Ecosystem-specific package/module contributions; each adapter reads its own branch. */
  manifest: RecipeManifest;
  /** Regex replacements applied per overlay (or template id) after the recipe overlay is copied */
  fileTransforms?: Record<string, RecipeFileTransform[]>;
  /**
   * Optional post-copy hook (e.g. Nest Biome decorator flags). Prefer
   * `fileTransforms` when a regex/append is enough.
   *
   * Receives the staging root. Hooks are trusted kit code: keep every write
   * inside that root (`resolveStagingPath` / `assertStagingRealPath`).
   */
  finalize?: (targetDir: string, context: FinalizeContext) => void;
};

export type ScaffoldConfig = {
  projectName: string;
  templateId: string;
  recipeIds: string[];
  targetDir?: string;
  /** Package manager the project will use; recipes (e.g. CI) may tailor output to it. */
  packageManager?: PackageManager;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
