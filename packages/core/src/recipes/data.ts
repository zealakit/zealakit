import fs from "node:fs";
import path from "node:path";
import { ECOSYSTEMS, RECIPE_CATEGORIES, SCOPES, UI_FRAMEWORKS } from "../constants.js";
import type {
  EcosystemId,
  ExternalRecipeInfo,
  RecipeCategory,
  RecipeConfig,
  RecipeFileTransform,
  Scope,
  UiFramework,
} from "../types.js";

/** `recipe.json` — the data form of a recipe (what `defineRecipe` builds in code). */
export const RECIPE_DATA_FILE = "recipe.json";
export const RECIPE_DATA_SCHEMA_VERSION = 1;

type Json = Record<string, unknown>;

export type RecipeDataResult = { ok: true; recipe: RecipeConfig } | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_PATTERN_LENGTH = 400;
const ALLOWED_FLAGS = /^[gimsu]*$/;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown, label: string, errors: string[]): Record<string, string> {
  if (value === undefined) return {};
  if (!isObject(value) || Object.values(value).some((entry) => typeof entry !== "string")) {
    errors.push(`${label} must be an object of string values.`);
    return {};
  }
  return { ...(value as Record<string, string>) };
}

function nestedStringRecord(
  value: unknown,
  label: string,
  errors: string[],
): Record<string, Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    errors.push(`${label} must be an object keyed by template/overlay id.`);
    return undefined;
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = stringRecord(entry, `${label}.${key}`, errors);
  }
  return out;
}

function stringList(value: unknown, label: string, errors: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} must be an array of strings.`);
    return undefined;
  }
  return [...(value as string[])];
}

function parseTransform(
  raw: unknown,
  label: string,
  errors: string[],
): RecipeFileTransform | undefined {
  if (!isObject(raw) || typeof raw.file !== "string" || raw.file === "") {
    errors.push(`${label}: needs a "file" string.`);
    return undefined;
  }
  const file = raw.file;
  if (typeof raw.append === "string") {
    return { file, append: raw.append };
  }
  if (typeof raw.marker === "string" && typeof raw.insert === "string") {
    const position = raw.position === "before" ? "before" : "after";
    return { file, marker: raw.marker, insert: raw.insert, position };
  }
  if (typeof raw.pattern === "string" && typeof raw.replacement === "string") {
    const flags = typeof raw.flags === "string" ? raw.flags : "";
    if (raw.pattern.length > MAX_PATTERN_LENGTH || !ALLOWED_FLAGS.test(flags)) {
      errors.push(`${label}: pattern too long or flags not in [gimsu].`);
      return undefined;
    }
    try {
      return { file, pattern: new RegExp(raw.pattern, flags), replacement: raw.replacement };
    } catch {
      errors.push(`${label}: invalid regular expression.`);
      return undefined;
    }
  }
  errors.push(
    `${label}: needs append, marker+insert, or pattern+replacement (no code is allowed).`,
  );
  return undefined;
}

/** Validate a parsed `recipe.json` and build a `RecipeConfig`. Never throws. */
export function parseRecipeData(json: unknown, options: { dir: string }): RecipeDataResult {
  const errors: string[] = [];
  if (!isObject(json))
    return { ok: false, errors: [`${RECIPE_DATA_FILE} must contain a JSON object.`] };

  if (json.schemaVersion !== RECIPE_DATA_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${RECIPE_DATA_SCHEMA_VERSION}.`);
  }
  if (typeof json.id !== "string" || !ID_PATTERN.test(json.id)) {
    errors.push("id must be lowercase letters, digits and dashes.");
  }
  if (typeof json.name !== "string" || json.name === "") errors.push("name is required.");

  const categories = (Array.isArray(json.category) ? json.category : [json.category]) as unknown[];
  if (
    categories.length === 0 ||
    categories.some((c) => !(RECIPE_CATEGORIES as readonly string[]).includes(c as string))
  ) {
    errors.push(`category must be one or more of: ${RECIPE_CATEGORIES.join(", ")}.`);
  }
  const scopes = json.supportedScopes;
  if (
    scopes !== "all" &&
    !(
      Array.isArray(scopes) &&
      scopes.length > 0 &&
      scopes.every((s) => (SCOPES as readonly string[]).includes(s as string))
    )
  ) {
    errors.push(`supportedScopes must be "all" or a list of: ${SCOPES.join(", ")}.`);
  }
  const ecosystem = (json.ecosystem ?? "node") as string;
  if (!(ECOSYSTEMS as readonly string[]).includes(ecosystem)) {
    errors.push(`ecosystem must be one of: ${ECOSYSTEMS.join(", ")}.`);
  }
  const uiFrameworks = stringList(json.uiFrameworks, "uiFrameworks", errors);
  if (uiFrameworks?.some((f) => !(UI_FRAMEWORKS as readonly string[]).includes(f))) {
    errors.push(`uiFrameworks must be a subset of: ${UI_FRAMEWORKS.join(", ")}.`);
  }
  for (const forbidden of ["finalize", "script", "code", "hooks"]) {
    if (forbidden in json)
      errors.push(`"${forbidden}" is not allowed: external recipes are data only.`);
  }

  const dependsOn = stringList(json.dependsOn, "dependsOn", errors);
  const requiresAnyOf = stringList(json.requiresAnyOf, "requiresAnyOf", errors);

  const npm = isObject(json.npm) ? json.npm : undefined;
  const go = isObject(json.go) ? json.go : undefined;
  if (json.npm !== undefined && !npm) errors.push("npm must be an object.");
  if (json.go !== undefined && !go) errors.push("go must be an object.");
  if (ecosystem === "go" && npm) errors.push("a go recipe cannot declare npm packages.");
  if (ecosystem === "node" && go) errors.push("a node recipe cannot declare go modules.");

  const fileTransforms: Record<string, RecipeFileTransform[]> = {};
  if (json.transforms !== undefined) {
    if (!isObject(json.transforms)) {
      errors.push("transforms must be an object keyed by template/overlay id.");
    } else {
      for (const [key, list] of Object.entries(json.transforms)) {
        if (!Array.isArray(list)) {
          errors.push(`transforms.${key} must be an array.`);
          continue;
        }
        fileTransforms[key] = list.flatMap((item, index) => {
          const parsed = parseTransform(item, `transforms.${key}[${index}]`, errors);
          return parsed ? [parsed] : [];
        });
      }
    }
  }

  const manifest =
    ecosystem === "go"
      ? ({ ecosystem: "go", goModules: stringRecord(go?.modules, "go.modules", errors) } as const)
      : ({
          ecosystem: "node",
          packages: stringRecord(npm?.dependencies, "npm.dependencies", errors),
          devDependencies: stringRecord(npm?.devDependencies, "npm.devDependencies", errors),
          scripts: stringRecord(npm?.scripts, "npm.scripts", errors),
          ...(npm?.overlayDependencies !== undefined
            ? {
                overlayPackages: nestedStringRecord(
                  npm.overlayDependencies,
                  "npm.overlayDependencies",
                  errors,
                ),
              }
            : {}),
          ...(npm?.overlayDevDependencies !== undefined
            ? {
                overlayDevDependencies: nestedStringRecord(
                  npm.overlayDevDependencies,
                  "npm.overlayDevDependencies",
                  errors,
                ),
              }
            : {}),
        } as const);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    recipe: {
      id: json.id as string,
      name: json.name as string,
      ...(typeof json.hint === "string" ? { hint: json.hint } : {}),
      category: (categories.length === 1 ? categories[0] : categories) as
        | RecipeCategory
        | RecipeCategory[],
      supportedScopes: scopes === "all" ? "all" : (scopes as Scope[]),
      ...(uiFrameworks ? { uiFrameworks: uiFrameworks as UiFramework[] } : {}),
      exclusive: json.exclusive === true,
      ...(dependsOn ? { dependsOn } : {}),
      ...(requiresAnyOf ? { requiresAnyOf } : {}),
      path: options.dir,
      ecosystem: ecosystem as EcosystemId,
      manifest,
      ...(Object.keys(fileTransforms).length > 0 ? { fileTransforms } : {}),
    },
  };
}

/** Every file or folder under `dir` that is a symlink (external recipes may not contain any). */
export function findSymlinks(dir: string): string[] {
  const found: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) found.push(path.relative(dir, full));
      else if (entry.isDirectory()) visit(full);
    }
  };
  visit(dir);
  return found.sort();
}

/**
 * Load a recipe folder (`recipe.json` + `shared/`, `overlays/`, `scaffold/`,
 * `.agents/`). Rejects symlinks and any code-like field; `finalize` never exists.
 */
export function loadRecipeDirectory(dir: string, external?: ExternalRecipeInfo): RecipeDataResult {
  const root = path.resolve(dir);
  const file = path.join(root, RECIPE_DATA_FILE);
  if (!fs.existsSync(file)) {
    return { ok: false, errors: [`No ${RECIPE_DATA_FILE} in '${root}'.`] };
  }
  const links = findSymlinks(root);
  if (links.length > 0) {
    return {
      ok: false,
      errors: [`External recipes may not contain symbolic links: ${links.join(", ")}`],
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    return {
      ok: false,
      errors: [
        `${RECIPE_DATA_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  const parsed = parseRecipeData(json, { dir: root });
  if (!parsed.ok) return parsed;
  return { ok: true, recipe: external ? { ...parsed.recipe, external } : parsed.recipe };
}
