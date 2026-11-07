import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiErrorCode,
  ExitCode,
  PACKAGE_ROOT,
} from "@zealakit/core";
import { exitCodeForDiscoveryResponse } from "../../apps/cli/src/discovery/query.js";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-discovery-cli-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

function runQuery(
  input: string,
  extraArgs: string[] = [],
  cwd: string = workRoot,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", TSX_LOADER, CLI_ENTRY, "discovery", "query", ...extraArgs],
    {
      cwd,
      encoding: "utf-8",
      env: noColorEnv(),
      input,
      timeout: 60_000,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parse(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

describe("zealakit discovery query", () => {
  it("returns questions as JSON on stdout", () => {
    const result = runQuery(
      JSON.stringify({ schemaVersion: 1, operation: "questions", answers: {} }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.schemaVersion, 1);
    assert.equal(response.ok, true);
    assert.equal(response.operation, "questions");
    const data = response.data as { question: { id: string } | null };
    assert.equal(data.question?.id, "projectType");
  });

  it("returns recommendations as JSON on stdout", () => {
    const result = runQuery(
      JSON.stringify({
        schemaVersion: 1,
        operation: "recommendations",
        answers: {
          projectType: "server-api",
          backendRuntime: "node",
          apiStorageNeed: "relational",
        },
      }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const data = parse(result.stdout).data as {
      recommendedTemplateId: string | null;
      templates: unknown[];
      recipes: unknown[];
    };
    assert.equal(data.recommendedTemplateId, "hono");
    assert.ok(data.templates.length > 0);
    assert.ok(data.recipes.length > 0);
  });

  it("returns structured validation errors with exit 3", () => {
    const result = runQuery(
      JSON.stringify({
        schemaVersion: 1,
        operation: "validate",
        selection: { templateId: "next", recipeIds: ["pinia"] },
      }),
    );
    assert.equal(result.status, 3);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.ok, true);
    const data = response.data as { valid: boolean; errors: { code: string }[] };
    assert.equal(data.valid, false);
    assert.ok(data.errors.some((error) => error.code === "INCOMPATIBLE_RECIPE"));
  });

  it("returns INVALID_ANSWERS for invalid answers with exit 3", () => {
    const result = runQuery(
      JSON.stringify({
        schemaVersion: 1,
        operation: "questions",
        answers: { projectType: "nope" },
      }),
    );
    assert.equal(result.status, 3);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.ok, false);
    assert.equal((response.error as { code: string }).code, "INVALID_ANSWERS");
  });

  it("returns INVALID_REQUEST for malformed JSON with exit 2", () => {
    const result = runQuery("{ not json");
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.ok, false);
    assert.equal((response.error as { code: string }).code, "INVALID_REQUEST");
  });

  it("reads the request from --input", () => {
    const requestPath = path.join(workRoot, "request.json");
    fs.writeFileSync(
      requestPath,
      JSON.stringify({ schemaVersion: 1, operation: "questions", answers: { projectType: "ui" } }),
      "utf-8",
    );
    const result = runQuery("", ["--input", requestPath]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const data = parse(result.stdout).data as { question: { id: string } | null };
    assert.equal(data.question?.id, "websiteKind");
  });

  it("does not scaffold or write project files", () => {
    const cwd = fs.mkdtempSync(path.join(workRoot, "cwd-"));
    runQuery(
      JSON.stringify({
        schemaVersion: 1,
        operation: "validate",
        selection: { templateId: "nest", recipeIds: [] },
      }),
      [],
      cwd,
    );
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("keeps unknown options as usage errors", () => {
    const result = runQuery("", ["--nope"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown option/i);
  });
});

describe("Discovery JSON exit-code mapping", () => {
  const failure = (code: string) => ({
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    ok: false as const,
    operation: null,
    error: { code: code as DiscoveryApiErrorCode, message: "", details: [] },
  });

  it("maps request and confirmation failures to usage", () => {
    assert.equal(exitCodeForDiscoveryResponse(failure("INVALID_REQUEST")), ExitCode.USAGE);
    assert.equal(exitCodeForDiscoveryResponse(failure("CONFIRMATION_REQUIRED")), ExitCode.USAGE);
    assert.equal(exitCodeForDiscoveryResponse(failure("PROJECT_NAME_INVALID")), ExitCode.USAGE);
  });

  it("maps validation failures to 3 and scaffold execution failures to 1", () => {
    assert.equal(exitCodeForDiscoveryResponse(failure("SELECTION_INVALID")), ExitCode.VALIDATION);
    assert.equal(exitCodeForDiscoveryResponse(failure("TARGET_EXISTS")), ExitCode.VALIDATION);
    assert.equal(
      exitCodeForDiscoveryResponse(failure("SCAFFOLD_VALIDATION_FAILED")),
      ExitCode.VALIDATION,
    );
    assert.equal(exitCodeForDiscoveryResponse(failure("SCAFFOLD_FAILED")), ExitCode.INTERNAL);
  });

  it("maps successful and invalid validate responses", () => {
    assert.equal(
      exitCodeForDiscoveryResponse({
        schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
        ok: true,
        operation: "questions",
        data: { question: null, complete: true, answered: [], progress: { answered: 0, total: 0 } },
      }),
      ExitCode.OK,
    );
    assert.equal(
      exitCodeForDiscoveryResponse({
        schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
        ok: true,
        operation: "validate",
        data: {
          valid: false,
          errors: [],
          warnings: [],
          templateId: "nest",
          resolvedRecipeIds: [],
        },
      }),
      ExitCode.VALIDATION,
    );
  });
});
