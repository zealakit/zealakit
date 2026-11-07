import {
  type CliMetadata,
  ExitCode,
  INFO_COMMAND,
  INFO_SCHEMA_VERSION,
  type InfoFilterInput,
  type InfoResponse,
  type InfoSchemaVersion,
  type MetadataQueryResult,
  printError,
  queryMetadata,
} from "@zealakit/core";
import pc from "picocolors";
import { readKitManifest } from "./manifest.js";

export type { InfoResponse, InfoSchemaVersion };
export { INFO_SCHEMA_VERSION };

/** Raw CLI options for `zealakit info` (strings validated by the query layer). */
export type InfoCommandOptions = {
  json?: boolean;
  ecosystem?: string;
  scope?: string;
  projectType?: string;
  uiFramework?: string;
  capability?: string;
  template?: string;
  recipe?: string;
  category?: string;
  discover?: boolean;
};

/** CLI/package metadata is CLI-owned; core never reads the root package.json. */
export function readCliMetadata(): CliMetadata {
  const manifest = readKitManifest();
  return {
    name: manifest.name,
    bin: "zealakit",
    version: manifest.version,
    description: manifest.description ?? null,
    homepage: manifest.homepage ?? null,
    engines: manifest.engines ?? {},
    usage: {
      create: "zealakit create",
      discover: "zealakit create --discover",
      scaffold: "zealakit create <project-name> -t <template> -w <recipe,recipe> -y",
      dryRun: "zealakit create <project-name> -t <template> -w <recipe,recipe> --dry-run",
      info: "zealakit info --json",
    },
  };
}

function toFilterInput(options: InfoCommandOptions): InfoFilterInput {
  return {
    ...(options.ecosystem !== undefined ? { ecosystem: options.ecosystem } : {}),
    ...(options.scope !== undefined ? { scope: options.scope } : {}),
    ...(options.projectType !== undefined ? { projectType: options.projectType } : {}),
    ...(options.uiFramework !== undefined ? { uiFramework: options.uiFramework } : {}),
    ...(options.capability !== undefined ? { capability: options.capability } : {}),
    ...(options.template !== undefined ? { templateId: options.template } : {}),
    ...(options.recipe !== undefined ? { recipeId: options.recipe } : {}),
    ...(options.category !== undefined ? { category: options.category } : {}),
    ...(options.discover ? { discovery: true } : {}),
  };
}

function toInfoResponse(query: Extract<MetadataQueryResult, { ok: true }>): InfoResponse {
  return {
    schemaVersion: INFO_SCHEMA_VERSION,
    command: INFO_COMMAND,
    filters: query.filter,
    data: query.data,
  };
}

/** Shared metadata snapshot used by `info` (throws on an invalid filter). */
export function buildInfoResponse(options: InfoCommandOptions = {}): InfoResponse {
  const query = queryMetadata(toFilterInput(options), { cli: readCliMetadata() });
  if (!query.ok) {
    throw new Error(query.errors.join("\n"));
  }
  return toInfoResponse(query);
}

function filterLines(response: InfoResponse): string[] {
  const entries = Object.entries(response.filters);
  if (entries.length === 0) {
    return [];
  }
  return [pc.bold("Filters"), ...entries.map(([key, value]) => `  ${key}: ${String(value)}`), ""];
}

function formatInfo(response: InfoResponse): string {
  const { data } = response;
  const lines: string[] = [`${pc.bold(data.cli?.name ?? "zealakit")} ${data.cli?.version ?? ""}`];
  lines.push("", ...filterLines(response), pc.bold("Templates"));
  if (data.templates.length === 0) {
    lines.push(`  ${pc.dim("(none)")}`);
  }
  for (const template of data.templates) {
    const tags = [template.scope, template.uiFramework].filter(Boolean).join(", ");
    const flags = template.isDefault ? pc.dim(" [default]") : "";
    lines.push(
      `  ${pc.cyan(template.id.padEnd(20))} ${template.label} ${pc.dim(`(${tags})`)}${flags}`,
    );
  }

  lines.push("", pc.bold("Recipes"));
  if (data.recipes.length === 0) {
    lines.push(`  ${pc.dim("(none)")}`);
  }
  for (const recipe of data.recipes) {
    const flags = [recipe.exclusive ? "exclusive" : null, recipe.default ? "auto" : null]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `  ${pc.cyan(recipe.id.padEnd(22))} ${recipe.categories.join("/").padEnd(26)} ${recipe.templates.join(", ")}${flags ? pc.dim(` [${flags}]`) : ""}`,
    );
  }

  if (response.filters.discovery) {
    lines.push(
      "",
      pc.dim("Discovery profiles included (templates[].discovery, recipes[].discovery)."),
    );
  }
  lines.push("", pc.dim("Use --json for the full machine-readable schema."));
  return lines.join("\n");
}

/**
 * `zealakit info` action.
 *
 * - JSON mode: stdout receives exactly one JSON document and nothing else.
 * - Invalid filters exit with `ExitCode.USAGE` (2); diagnostics go to stderr,
 *   so stdout never contains partial or error JSON.
 */
export function runInfo(options: InfoCommandOptions = {}): ExitCode {
  try {
    const query = queryMetadata(toFilterInput(options), { cli: readCliMetadata() });
    if (!query.ok) {
      for (const message of query.errors) {
        printError(message);
      }
      printError("Run `zealakit info --help` to see available values.");
      return ExitCode.USAGE;
    }

    const response = toInfoResponse(query);
    // Build the whole document first so a failure never writes partial JSON.
    const output = options.json ? JSON.stringify(response, null, 2) : formatInfo(response);
    process.stdout.write(`${output}\n`);
    return ExitCode.OK;
  } catch (error) {
    // Retrieval/formatting failures keep stdout empty; diagnostics go to stderr.
    printError(error instanceof Error ? error.message : String(error));
    return ExitCode.INTERNAL;
  }
}
