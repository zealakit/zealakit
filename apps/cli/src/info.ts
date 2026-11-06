import {
  type CliMetadata,
  ExitCode,
  getInfo,
  INFO_SCHEMA_VERSION,
  type InfoErrorResponse,
  type InfoFilterInput,
  type InfoResponse,
  type InfoSchemaVersion,
  normalizeInfoFilter,
  printError,
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
    ...(options.template !== undefined ? { templateId: options.template } : {}),
    ...(options.recipe !== undefined ? { recipeId: options.recipe } : {}),
    ...(options.category !== undefined ? { category: options.category } : {}),
    ...(options.discover ? { discovery: true } : {}),
  };
}

/** Shared metadata snapshot used by `info` (throws on an invalid filter). */
export function buildInfoResponse(options: InfoCommandOptions = {}): InfoResponse {
  const normalized = normalizeInfoFilter(toFilterInput(options));
  if (!normalized.ok) {
    throw new Error(normalized.errors.join("\n"));
  }
  return getInfo(normalized.filter, { cli: readCliMetadata() });
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

function writeInvalidFilterError(errors: string[]): void {
  const error: InfoErrorResponse = {
    schemaVersion: INFO_SCHEMA_VERSION,
    command: "info",
    error: {
      code: "invalid-filter",
      message: "One or more info filters are invalid.",
      details: errors,
    },
  };
  process.stdout.write(`${JSON.stringify(error, null, 2)}\n`);
}

/**
 * `zealakit info` action.
 *
 * - JSON mode: stdout receives exactly one JSON document (success envelope or
 *   machine-readable error), never ANSI/Clack output.
 * - Invalid filters exit with `ExitCode.USAGE` (2) and are never ignored.
 */
export function runInfo(options: InfoCommandOptions = {}): ExitCode {
  const normalized = normalizeInfoFilter(toFilterInput(options));
  if (!normalized.ok) {
    if (options.json) {
      writeInvalidFilterError(normalized.errors);
    } else {
      for (const message of normalized.errors) {
        printError(message);
      }
      printError("Run `zealakit info --help` to see available values.");
    }
    return ExitCode.USAGE;
  }

  const response = getInfo(normalized.filter, { cli: readCliMetadata() });
  process.stdout.write(
    `${options.json ? JSON.stringify(response, null, 2) : formatInfo(response)}\n`,
  );
  return ExitCode.OK;
}
