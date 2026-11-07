import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { PACKAGE_ROOT } from "@zealakit/core";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-create-json-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runCreateJson(
  input: string,
  extraArgs: string[] = [],
  cwd: string = caseDir(),
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", TSX_LOADER, CLI_ENTRY, "create", "--discover", "--json", ...extraArgs],
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

function scaffoldRequest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    operation: "scaffold",
    answers: { projectType: "ui", uiTechPreference: "react" },
    selection: { templateId: "vite-react", recipeIds: [] },
    project: { name: "my-app" },
    confirmation: { confirmed: true },
    ...overrides,
  });
}

describe("zealakit create --discover --json", () => {
  it("returns questions without prompting", () => {
    const result = runCreateJson(
      JSON.stringify({ schemaVersion: 1, operation: "questions", answers: {} }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.operation, "questions");
    assert.equal(response.ok, true);
    const data = response.data as { question: { id: string } | null };
    assert.equal(data.question?.id, "projectType");
  });

  it("returns recommendations", () => {
    const result = runCreateJson(
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
    const data = parse(result.stdout).data as { recommendedTemplateId: string | null };
    assert.equal(data.recommendedTemplateId, "hono");
  });

  it("validates a selection", () => {
    const result = runCreateJson(
      JSON.stringify({
        schemaVersion: 1,
        operation: "validate",
        selection: { templateId: "nest", recipeIds: ["biome"] },
      }),
    );
    assert.equal(result.status, 0, result.stderr);
    const data = parse(result.stdout).data as { valid: boolean };
    assert.equal(data.valid, true);
  });

  it("does not scaffold without confirmation", () => {
    const cwd = caseDir();
    const result = runCreateJson(scaffoldRequest({ confirmation: undefined }), [], cwd);
    assert.equal(result.status, 2);
    assert.deepEqual(fs.readdirSync(cwd), []);
    const error = parse(result.stdout).error as { code: string };
    assert.equal(error.code, "CONFIRMATION_REQUIRED");
  });

  it("does not scaffold with false confirmation", () => {
    const cwd = caseDir();
    const result = runCreateJson(scaffoldRequest({ confirmation: { confirmed: false } }), [], cwd);
    assert.equal(result.status, 2);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("scaffolds with explicit confirmation", () => {
    const cwd = caseDir();
    const result = runCreateJson(scaffoldRequest(), [], cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const response = parse(result.stdout);
    assert.equal(response.operation, "scaffold");
    assert.equal(response.ok, true);
    const data = response.data as {
      projectName: string;
      templateId: string;
      outputDirectory: string;
    };
    assert.equal(data.projectName, "my-app");
    assert.equal(data.outputDirectory, "my-app");
    assert.ok(fs.existsSync(path.join(cwd, "my-app", "package.json")));
  });

  it("rejects invalid selections without writing", () => {
    const cwd = caseDir();
    const result = runCreateJson(
      scaffoldRequest({ selection: { templateId: "next", recipeIds: ["pinia"] } }),
      [],
      cwd,
    );
    assert.equal(result.status, 3);
    assert.deepEqual(fs.readdirSync(cwd), []);
    const error = parse(result.stdout).error as { code: string };
    assert.equal(error.code, "SELECTION_INVALID");
  });

  it("returns INVALID_REQUEST for malformed JSON", () => {
    const result = runCreateJson("{ not json");
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    const error = parse(result.stdout).error as { code: string };
    assert.equal(error.code, "INVALID_REQUEST");
  });

  it("rejects incompatible CLI options", () => {
    for (const args of [["-y"], ["-t", "next"], ["-w", "biome"], ["--dry-run"]]) {
      const result = runCreateJson("{}", args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /cannot be combined|requires --discover/i);
    }
  });

  it("requires --discover for --json on create", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, CLI_ENTRY, "create", "--json"],
      {
        cwd: caseDir(),
        encoding: "utf-8",
        env: noColorEnv(),
        input: "{}",
        timeout: 60_000,
      },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr ?? "", /requires --discover/i);
  });

  it("leaves the interactive Discovery flow available without --json", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, CLI_ENTRY, "create", "--discover"],
      {
        cwd: caseDir(),
        encoding: "utf-8",
        env: noColorEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      },
    );
    assert.equal(result.status, 0);
  });
});
