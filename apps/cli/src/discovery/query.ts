import fs from "node:fs";
import {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiErrorResponse,
  type DiscoveryApiResponse,
  ExitCode,
  handleDiscoveryRequest,
} from "@zealakit/core";
import type { Command } from "commander";

export type DiscoveryQueryOptions = {
  /** Read the JSON request from this file instead of stdin. */
  input?: string;
  /** Base directory for scaffold destinations (defaults to `process.cwd()`). */
  cwd?: string;
};

function errorResponse(
  code: DiscoveryApiErrorResponse["error"]["code"],
  message: string,
  details: string[] = [],
): DiscoveryApiErrorResponse {
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: false,
    operation: null,
    error: { code, message, details },
  };
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

type ReadResult = { ok: true; raw: string } | { ok: false; error: DiscoveryApiErrorResponse };

async function readRequest(options: DiscoveryQueryOptions): Promise<ReadResult> {
  if (options.input !== undefined) {
    try {
      return { ok: true, raw: fs.readFileSync(options.input, "utf-8") };
    } catch (error) {
      return {
        ok: false,
        error: errorResponse(
          DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
          `Could not read request file '${options.input}': ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  if (process.stdin.isTTY) {
    return {
      ok: false,
      error: errorResponse(
        DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
        "Provide a Discovery request JSON on stdin or with --input <file>.",
      ),
    };
  }

  try {
    return { ok: true, raw: await readStdin() };
  } catch (error) {
    return {
      ok: false,
      error: errorResponse(
        DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
        `Could not read stdin: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

/** Map a Discovery API response to the documented CLI exit codes. */
export function exitCodeForDiscoveryResponse(response: DiscoveryApiResponse): ExitCode {
  if (response.ok) {
    if (response.operation === "validate" && !response.data.valid) {
      return ExitCode.VALIDATION;
    }
    return ExitCode.OK;
  }

  switch (response.error.code) {
    case DISCOVERY_API_ERROR_CODES.INVALID_REQUEST:
    case DISCOVERY_API_ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION:
    case DISCOVERY_API_ERROR_CODES.UNKNOWN_OPERATION:
    case DISCOVERY_API_ERROR_CODES.CONFIRMATION_REQUIRED:
    case DISCOVERY_API_ERROR_CODES.INVALID_SELECTION:
    case DISCOVERY_API_ERROR_CODES.INVALID_PROJECT:
    case DISCOVERY_API_ERROR_CODES.PROJECT_NAME_INVALID:
    case DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY:
      return ExitCode.USAGE;
    case DISCOVERY_API_ERROR_CODES.INTERNAL:
    case DISCOVERY_API_ERROR_CODES.SCAFFOLD_FAILED:
      return ExitCode.INTERNAL;
    default:
      return ExitCode.VALIDATION;
  }
}

/**
 * `zealakit discovery query` — stateless JSON operations.
 * Reads one request from stdin (or `--input`), writes one response to stdout.
 * It never scaffolds, prompts, or persists state.
 */
export async function runDiscoveryQuery(options: DiscoveryQueryOptions = {}): Promise<ExitCode> {
  const read = await readRequest(options);
  let response: DiscoveryApiResponse;
  if (!read.ok) {
    response = read.error;
  } else {
    try {
      response = await handleDiscoveryRequest(JSON.parse(read.raw), { cwd: options.cwd });
    } catch (error) {
      response = errorResponse(
        DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
        `Request is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  return exitCodeForDiscoveryResponse(response);
}

export function registerDiscoveryQueryCommand(discovery: Command): void {
  discovery
    .command("query")
    .description(
      "Run a stateless Discovery JSON operation (questions | recommendations | validate | scaffold); reads a request from stdin or --input",
    )
    .option("--input <file>", "Read the JSON request from a file instead of stdin")
    .action(async (options: DiscoveryQueryOptions) => {
      process.exitCode = await runDiscoveryQuery(options);
    });
}
