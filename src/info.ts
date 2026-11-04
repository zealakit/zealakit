import pc from "picocolors";
import {
  checkRecipeCompatibility,
  getConflictingRecipes,
  type IncompatibilityCode,
} from "./compat.js";
import { FRAMEWORKS, RECIPE_CATEGORIES, SCOPES } from "./constants.js";
import { readKitManifest } from "./manifest.js";
import { getStepInitialValue, getStepOptions, STEPS_BY_SCOPE } from "./prompt-steps.js";
import {
  DEFAULT_TEMPLATE_ID,
  getRecipeCategories,
  getRecipesByCategory,
  getTemplateDevCommand,
  getTemplateOverlayId,
  recipes,
  templates,
  withDefaultRecipes,
} from "./registry/index.js";
import { getRecipeAgentEntry } from "./scaffold/agent-docs.js";
import type { Framework, RecipeCategory, RecipeConfig, Scope, TemplateConfig } from "./types.js";

/** Bump when a key is renamed/removed; adding keys is backwards compatible. */
export const INFO_SCHEMA_VERSION = 1;

export type PromptStepInfo =
  | {
      kind: "select";
      category: RecipeCategory;
      message: string;
      noneLabel: string;
      /** Preselected recipe id; `null` = "none" */
      initialValue: string | null;
      options: string[];
      notice?: string;
    }
  | { kind: "confirm"; recipeId: string; message: string; options: string[]; notice?: string };

export type TemplateInfo = {
  id: string;
  name: string;
  label: string;
  description: string;
  scope: Scope;
  framework: Framework | null;
  path: string;
  overlay: string;
  srcDir: string;
  devCommand: string;
  isDefault: boolean;
  /** Injected automatically for this template (not prompted) */
  defaultRecipes: string[];
  /** Every recipe that can be applied to this template */
  compatibleRecipes: string[];
  /** Interactive flow for this template, in order; steps without options are omitted */
  promptSteps: PromptStepInfo[];
};

export type CategoryInfo = {
  id: RecipeCategory;
  /** At most one of `exclusiveRecipes` may be selected */
  exclusive: boolean;
  /** Whether the user must pick a recipe in this category */
  required: boolean;
  /** Contains recipes injected automatically (`defaultRecipes`) */
  auto: boolean;
  recipes: string[];
  exclusiveRecipes: string[];
  /** May be combined with any exclusive pick (e.g. Storybook beside a UI kit) */
  nonExclusiveRecipes: string[];
  defaultRecipes: string[];
};

export type RecipeInfo = {
  id: string;
  name: string;
  hint: string | null;
  primaryCategory: RecipeCategory;
  categories: RecipeCategory[];
  exclusive: boolean;
  default: boolean;
  /** Direct recipe dependencies (transitive closure resolved at scaffold time) */
  dependsOn: string[];
  supportedScopes: Scope[] | "all";
  /** `null` = framework-agnostic */
  frameworks: Framework[] | null;
  /** Template ids the recipe can be applied to */
  templates: string[];
  incompatibleTemplates: { templateId: string; code: IncompatibilityCode; message: string }[];
  /** Recipes that cannot be selected together with this one */
  conflictsWith: string[];
  packages: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Keyed by overlay id */
  overlayPackages: Record<string, Record<string, string>>;
  overlayDevDependencies: Record<string, Record<string, string>>;
  scripts: Record<string, string>;
  /** Files rewritten after copy, keyed by template or overlay id */
  transformedFiles: Record<string, string[]>;
  /** Adds links to generated AGENTS.md / CLAUDE.md */
  hasAgentEntry: boolean;
};

export type RuleInfo = { id: string; description: string; recipes?: string[] };

export type KitInfo = {
  schemaVersion: typeof INFO_SCHEMA_VERSION;
  cli: {
    name: string;
    bin: string;
    version: string;
    description: string | null;
    homepage: string | null;
    engines: Record<string, string>;
    usage: { scaffold: string; dryRun: string; info: string };
  };
  defaults: { templateId: string; noneValue: string };
  scopes: Scope[];
  frameworks: Framework[];
  templates: TemplateInfo[];
  categories: CategoryInfo[];
  recipes: RecipeInfo[];
  rules: RuleInfo[];
};

const NONE_VALUE = "none";

function ids(list: RecipeConfig[]): string[] {
  return list.map((recipe) => recipe.id);
}

function templateInfo(template: TemplateConfig): TemplateInfo {
  const all = Object.values(recipes);
  return {
    id: template.id,
    name: template.name,
    label: template.label,
    description: template.description,
    scope: template.scope,
    framework: template.framework ?? null,
    path: template.path,
    overlay: getTemplateOverlayId(template.id),
    srcDir: template.srcDir ?? "src",
    devCommand: getTemplateDevCommand(template),
    isDefault: template.id === DEFAULT_TEMPLATE_ID,
    defaultRecipes: withDefaultRecipes(template.scope, []),
    compatibleRecipes: ids(all.filter((recipe) => !checkRecipeCompatibility(recipe, template))),
    promptSteps: STEPS_BY_SCOPE[template.scope].flatMap((step): PromptStepInfo[] => {
      const options = getStepOptions(step, template);
      if (options.length === 0) return [];
      return step.kind === "select"
        ? [
            {
              kind: "select",
              category: step.category,
              message: step.message,
              noneLabel: step.noneLabel,
              initialValue: getStepInitialValue(step, options) ?? null,
              options: ids(options),
              ...(step.notice ? { notice: step.notice } : {}),
            },
          ]
        : [
            {
              kind: "confirm",
              recipeId: step.recipeId,
              message: step.message,
              options: ids(options),
              ...(step.notice ? { notice: step.notice } : {}),
            },
          ];
    }),
  };
}

function categoryInfo(category: RecipeCategory): CategoryInfo {
  const members = getRecipesByCategory(category);
  const exclusiveRecipes = ids(members.filter((recipe) => recipe.exclusive));
  const defaultRecipes = ids(members.filter((recipe) => recipe.default));
  return {
    id: category,
    exclusive: exclusiveRecipes.length > 0,
    required: false,
    auto: defaultRecipes.length > 0,
    recipes: ids(members),
    exclusiveRecipes,
    nonExclusiveRecipes: ids(members.filter((recipe) => !recipe.exclusive)),
    defaultRecipes,
  };
}

function recipeInfo(recipe: RecipeConfig): RecipeInfo {
  const categories = getRecipeCategories(recipe);
  const compatible: string[] = [];
  const incompatible: RecipeInfo["incompatibleTemplates"] = [];
  for (const template of Object.values(templates)) {
    const issue = checkRecipeCompatibility(recipe, template);
    if (issue) {
      incompatible.push({ templateId: template.id, ...issue });
    } else {
      compatible.push(template.id);
    }
  }

  return {
    id: recipe.id,
    name: recipe.name,
    hint: recipe.hint ?? null,
    primaryCategory: categories[0] as RecipeCategory,
    categories,
    exclusive: recipe.exclusive ?? false,
    default: recipe.default ?? false,
    dependsOn: recipe.dependsOn ?? [],
    supportedScopes: recipe.supportedScopes,
    frameworks: recipe.frameworks ?? null,
    templates: compatible,
    incompatibleTemplates: incompatible,
    conflictsWith: getConflictingRecipes(recipe),
    packages: recipe.packages,
    devDependencies: recipe.devDependencies,
    overlayPackages: recipe.overlayPackages ?? {},
    overlayDevDependencies: recipe.overlayDevDependencies ?? {},
    scripts: recipe.scripts,
    transformedFiles: Object.fromEntries(
      Object.entries(recipe.fileTransforms ?? {}).map(([key, transforms]) => [
        key,
        [...new Set(transforms.map((transform) => transform.file))],
      ]),
    ),
    hasAgentEntry: getRecipeAgentEntry(recipe.id) !== undefined,
  };
}

function rules(): RuleInfo[] {
  const all = Object.values(recipes);
  return [
    {
      id: "scope-match",
      description:
        "A recipe applies only to templates whose scope is listed in supportedScopes (strict: hybrid does not accept server-only recipes).",
    },
    {
      id: "hybrid-orm-caveat",
      description:
        "ORM recipes also support hybrid (Next, Nuxt, etc.) as best-effort for small apps; interactive prompts and dry-run warn that a dedicated backend framework is preferred for production APIs.",
      recipes: ids(all.filter((recipe) => getRecipeCategories(recipe).includes("orm"))),
    },
    {
      id: "framework-match",
      description:
        "A recipe with frameworks applies only to templates using one of them; frameworks null means framework-agnostic.",
    },
    {
      id: "overlay-required",
      description:
        "A recipe that ships overlays must have an overlay for the template's overlay id.",
    },
    {
      id: "exclusive-per-category",
      description: "At most one exclusive recipe may be selected per category.",
      recipes: ids(all.filter((recipe) => recipe.exclusive)),
    },
    {
      id: "non-exclusive-coexist",
      description:
        "Non-exclusive recipes can be combined with any exclusive pick in the same category.",
      recipes: ids(all.filter((recipe) => !recipe.exclusive && !recipe.default)),
    },
    {
      id: "default-recipes",
      description:
        "Injected automatically (prepended) for every template whose scope they support; never prompted.",
      recipes: ids(all.filter((recipe) => recipe.default)),
    },
    {
      id: "recipe-dependencies",
      description:
        "Recipes may declare dependsOn; transitive deps are auto-injected before write, cycles and missing ids fail preflight.",
      recipes: ids(all.filter((recipe) => (recipe.dependsOn?.length ?? 0) > 0)),
    },
  ];
}

/** Static kit metadata for external UIs (`zealakit info --json`). Derived from the registry only. */
export function buildKitInfo(): KitInfo {
  const manifest = readKitManifest();
  return {
    schemaVersion: INFO_SCHEMA_VERSION,
    cli: {
      name: manifest.name,
      bin: "zealakit",
      version: manifest.version,
      description: manifest.description ?? null,
      homepage: manifest.homepage ?? null,
      engines: manifest.engines ?? {},
      usage: {
        scaffold: "zealakit <project-name> -t <template> -w <recipe,recipe> -y",
        dryRun: "zealakit <project-name> -t <template> -w <recipe,recipe> --dry-run",
        info: "zealakit info --json",
      },
    },
    defaults: { templateId: DEFAULT_TEMPLATE_ID, noneValue: NONE_VALUE },
    scopes: [...SCOPES],
    frameworks: [...FRAMEWORKS],
    templates: Object.values(templates).map(templateInfo),
    categories: RECIPE_CATEGORIES.map(categoryInfo),
    recipes: Object.values(recipes).map(recipeInfo),
    rules: rules(),
  };
}

function formatKitInfo(info: KitInfo): string {
  const lines = [`${pc.bold(info.cli.name)} ${info.cli.version}`, "", pc.bold("Templates")];
  for (const template of info.templates) {
    const tags = [template.scope, template.framework].filter(Boolean).join(", ");
    lines.push(`  ${pc.cyan(template.id.padEnd(12))} ${template.label} ${pc.dim(`(${tags})`)}`);
  }
  lines.push("", pc.bold("Recipes"));
  for (const recipe of info.recipes) {
    const flags = [recipe.exclusive ? "exclusive" : null, recipe.default ? "auto" : null]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `  ${pc.cyan(recipe.id.padEnd(22))} ${recipe.categories.join("/").padEnd(26)} ${recipe.templates.join(", ")}${flags ? pc.dim(` [${flags}]`) : ""}`,
    );
  }
  lines.push("", pc.dim("Use --json for the full machine-readable schema."));
  return lines.join("\n");
}

/** With `json`, stdout receives exactly one JSON document and nothing else. */
export function printKitInfo({ json }: { json: boolean }): void {
  const info = buildKitInfo();
  process.stdout.write(`${json ? JSON.stringify(info, null, 2) : formatKitInfo(info)}\n`);
}
