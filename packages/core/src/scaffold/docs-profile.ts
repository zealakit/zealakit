import fs from "node:fs";
import path from "node:path";

import { adaptRunCommand, type PackageManager } from "../package-manager.js";
import { getRecipe, getRecipeCategories, getTemplate } from "../registry/index.js";
import type { EcosystemId, ScaffoldConfig, TemplateConfig } from "../types.js";
import { assertStagingRealPath, resolveStagingPath } from "./paths.js";

/**
 * `repo-docs` profile generation for the docs recipes.
 *
 * The skill folder (`.agents/skills/repo-docs/`) is copied from the recipe;
 * `finalize` only writes the repository-specific `profile.json` so the
 * documented commands, units and sections match the generated project.
 */

export const DOCS_SKILL_DIR = ".agents/skills/repo-docs";
export const DOCS_PROFILE_FILE = `${DOCS_SKILL_DIR}/profile.json`;
export const DOCS_CHECK_SCRIPT = "scripts/check-docs.mjs";

export type DocsLayout = "app" | "service" | "worker" | "cli" | "library" | "monorepo";
export type DocsSectionId = "database" | "docker" | "authentication" | "testing" | "ci";
export type DocsLinkStyle = "absolute" | "relative";

export type DocsUnit = {
  dir: string;
  name: string;
  layout: DocsLayout;
  readme?: string;
};

export type DocsProfile = {
  $schema: string;
  projectName: string;
  ecosystem: EcosystemId;
  packageManager: PackageManager | null;
  units: DocsUnit[];
  languages: string[];
  linkStyle: DocsLinkStyle;
  absoluteBase: string | null;
  cover: string | null;
  license: string | null;
  sections: DocsSectionId[];
  docsDir: { enabled: boolean; pages: string[] };
  internalSkills: string | null;
  userSkills: string | null;
  check: string | null;
};

export type DocsProfileOptions = {
  /** Override the layout derived from the template scope. */
  layout?: DocsLayout;
  sections?: readonly DocsSectionId[];
  languages?: readonly string[];
  linkStyle?: DocsLinkStyle;
  absoluteBase?: string | null;
  license?: string | null;
  check?: string | null;
};

/** Recipes that own a database section, in addition to the `orm` category. */
const DATABASE_RECIPE_IDS = new Set([
  "postgres",
  "mysql",
  "mongodb",
  "postgres-python",
  "sqlc",
  "goose",
  "alembic",
  "sqlalchemy",
]);

/** Layout section order for recipe-contributed README sections. */
const SECTION_ORDER: readonly DocsSectionId[] = [
  "database",
  "docker",
  "authentication",
  "testing",
  "ci",
];

export function docsLayoutForTemplate(template: TemplateConfig): DocsLayout {
  switch (template.scope) {
    case "client":
    case "hybrid":
      return "app";
    case "server":
      return "service";
    case "infrastructure":
      return "worker";
  }
}

/** Recipe sections a project's README must document, in layout order. */
export function docsSectionsForRecipes(recipeIds: readonly string[]): DocsSectionId[] {
  const found = new Set<DocsSectionId>();
  for (const recipeId of recipeIds) {
    if (DATABASE_RECIPE_IDS.has(recipeId)) {
      found.add("database");
      continue;
    }
    const recipe = getRecipe(recipeId);
    if (!recipe) continue;
    if (recipeId === "docker" || recipeId.startsWith("docker-")) {
      found.add("docker");
    }
    const categories = getRecipeCategories(recipe);
    if (categories.includes("orm")) found.add("database");
    if (categories.includes("auth")) found.add("authentication");
    if (categories.includes("testing")) found.add("testing");
    if (categories.includes("ci")) found.add("ci");
  }
  return SECTION_ORDER.filter((section) => found.has(section));
}

/** Package-manager-aware `docs:check` command (Node only). */
export function docsCheckCommand(packageManager: PackageManager): string {
  return adaptRunCommand("npm run docs:check", packageManager);
}

export function buildDocsProfile(
  config: ScaffoldConfig,
  options: DocsProfileOptions = {},
): DocsProfile | undefined {
  const template = getTemplate(config.templateId);
  if (!template) return undefined;

  const ecosystem = template.ecosystem ?? "node";
  const packageManager = ecosystem === "node" ? (config.packageManager ?? "npm") : null;
  const layout = options.layout ?? docsLayoutForTemplate(template);
  return {
    $schema: "./profile.schema.json",
    projectName: config.projectName,
    ecosystem,
    packageManager,
    units: [{ dir: "", name: config.projectName, layout }],
    languages: [...(options.languages ?? ["en"])],
    linkStyle: options.linkStyle ?? "relative",
    absoluteBase: options.absoluteBase ?? null,
    cover: null,
    license: options.license ?? "MIT",
    sections: [...(options.sections ?? docsSectionsForRecipes(config.recipeIds))],
    docsDir: { enabled: false, pages: [] },
    internalSkills: ".agents/skills",
    userSkills: null,
    check: options.check ?? null,
  };
}

/** Write `profile.json` into the copied skill folder (no-op without a template). */
export function writeDocsProfile(
  targetDir: string,
  config: ScaffoldConfig,
  options: DocsProfileOptions = {},
): DocsProfile | undefined {
  const profile = buildDocsProfile(config, options);
  if (!profile) return undefined;

  const file = resolveStagingPath(targetDir, DOCS_PROFILE_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(file));
  if (fs.existsSync(file)) assertStagingRealPath(targetDir, file);
  fs.writeFileSync(file, `${JSON.stringify(profile, null, 2)}\n`, "utf-8");
  return profile;
}

/**
 * Copy the skill's checker to `scripts/check-docs.mjs` and return whether the
 * skill was present. The checker locates `profile.json` by walking up.
 */
export function copyDocsChecker(targetDir: string): boolean {
  const source = resolveStagingPath(targetDir, `${DOCS_SKILL_DIR}/check-docs.mjs`);
  if (!fs.existsSync(source)) return false;
  assertStagingRealPath(targetDir, source);
  const destination = resolveStagingPath(targetDir, DOCS_CHECK_SCRIPT);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(destination));
  fs.copyFileSync(source, destination);
  return true;
}
