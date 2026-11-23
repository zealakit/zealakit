import fs from "node:fs";
import path from "node:path";

import { ECOSYSTEMS } from "./constants.js";
import { KIT_VERSION } from "./scaffold/paths.js";
import type { EcosystemId, ExternalRecipeInfo } from "./types.js";

export const PROJECT_MANIFEST_FILE = "zealakit.json";
export const PROJECT_MANIFEST_SCHEMA_VERSION = 1;

/** Record of how a project was generated; read by `add` / `upgrade` / `doctor`. */
export type ProjectManifest = {
  $schema: string;
  schemaVersion: typeof PROJECT_MANIFEST_SCHEMA_VERSION;
  kitVersion: string;
  ecosystem: EcosystemId;
  template: string;
  /** Resolved apply order (defaults + `dependsOn` included). */
  recipes: string[];
  /** What the user asked for, before defaults and dependency expansion. */
  requestedRecipes: string[];
  createdAt: string;
  /** Recipes that came from outside the kit (data-only); re-resolved by `add` / `doctor` / `outdated`. */
  externalRecipes?: Array<ExternalRecipeInfo & { id: string }>;
};

export type ProjectManifestInput = {
  ecosystem: EcosystemId;
  template: string;
  recipes: string[];
  requestedRecipes: string[];
  kitVersion?: string;
  createdAt?: string;
  externalRecipes?: Array<ExternalRecipeInfo & { id: string }>;
};

export function projectManifestSchemaUrl(kitVersion: string = KIT_VERSION): string {
  return `https://unpkg.com/zealakit@${kitVersion}/schema/zealakit.schema.json`;
}

export function buildProjectManifest(input: ProjectManifestInput): ProjectManifest {
  const kitVersion = input.kitVersion ?? KIT_VERSION;
  return {
    $schema: projectManifestSchemaUrl(kitVersion),
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    kitVersion,
    ecosystem: input.ecosystem,
    template: input.template,
    recipes: [...input.recipes],
    requestedRecipes: [...input.requestedRecipes],
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.externalRecipes && input.externalRecipes.length > 0
      ? { externalRecipes: input.externalRecipes }
      : {}),
  };
}

export function serializeProjectManifest(manifest: ProjectManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export type ProjectManifestParse =
  | { ok: true; manifest: ProjectManifest }
  | { ok: false; errors: string[] };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Validate untrusted JSON (a hand-edited or newer-schema file) without throwing. */
export function parseProjectManifest(json: unknown): ProjectManifestParse {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, errors: [`${PROJECT_MANIFEST_FILE} must contain a JSON object.`] };
  }
  const data = json as Record<string, unknown>;
  const errors: string[] = [];

  if (data.schemaVersion !== PROJECT_MANIFEST_SCHEMA_VERSION) {
    errors.push(
      `${PROJECT_MANIFEST_FILE} schemaVersion must be ${PROJECT_MANIFEST_SCHEMA_VERSION} (got ${JSON.stringify(data.schemaVersion)}).`,
    );
  }
  for (const field of ["kitVersion", "template", "createdAt"] as const) {
    if (typeof data[field] !== "string" || data[field] === "") {
      errors.push(`${PROJECT_MANIFEST_FILE} field '${field}' must be a non-empty string.`);
    }
  }
  if (!(ECOSYSTEMS as readonly string[]).includes(data.ecosystem as string)) {
    errors.push(`${PROJECT_MANIFEST_FILE} field 'ecosystem' must be a known ecosystem.`);
  }
  for (const field of ["recipes", "requestedRecipes"] as const) {
    if (!isStringArray(data[field])) {
      errors.push(`${PROJECT_MANIFEST_FILE} field '${field}' must be an array of strings.`);
    }
  }
  let externalRecipes: ProjectManifest["externalRecipes"];
  if (data.externalRecipes !== undefined) {
    const list = data.externalRecipes;
    const valid =
      Array.isArray(list) &&
      list.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).id === "string" &&
          typeof (item as Record<string, unknown>).source === "string",
      );
    if (!valid) {
      errors.push(
        `${PROJECT_MANIFEST_FILE} field 'externalRecipes' must be an array of { id, source, ref?, sha? }.`,
      );
    } else {
      externalRecipes = (list as Array<Record<string, unknown>>).map((item) => {
        const entry: ExternalRecipeInfo & { id: string } = {
          id: item.id as string,
          source: item.source as string,
        };
        if (typeof item.ref === "string") entry.ref = item.ref;
        if (typeof item.sha === "string") entry.sha = item.sha;
        return entry;
      });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    manifest: {
      $schema: typeof data.$schema === "string" ? data.$schema : projectManifestSchemaUrl(),
      schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
      kitVersion: data.kitVersion as string,
      ecosystem: data.ecosystem as EcosystemId,
      template: data.template as string,
      recipes: [...(data.recipes as string[])],
      requestedRecipes: [...(data.requestedRecipes as string[])],
      createdAt: data.createdAt as string,
      ...(externalRecipes ? { externalRecipes } : {}),
    },
  };
}

/** Read and validate `<dir>/zealakit.json`; `undefined` when the file does not exist. */
export function readProjectManifest(dir: string): ProjectManifestParse | undefined {
  const file = path.join(dir, PROJECT_MANIFEST_FILE);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    return {
      ok: false,
      errors: [
        `${PROJECT_MANIFEST_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  return parseProjectManifest(json);
}
