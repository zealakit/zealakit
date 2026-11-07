import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { DISCOVERY_API_SCHEMA_VERSION, PACKAGE_ROOT } from "@zealakit/core";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-json-e2e-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type CliResult = {
  status: number | null;
  response: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
};

function runJson(cwd: string, request: unknown): CliResult {
  const input = typeof request === "string" ? request : JSON.stringify(request);
  const result = spawnSync(
    process.execPath,
    ["--import", TSX_LOADER, CLI_ENTRY, "create", "--discover", "--json"],
    {
      cwd,
      encoding: "utf-8",
      env: noColorEnv(),
      input,
      timeout: 60_000,
    },
  );
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  let response: Record<string, unknown> | null = null;
  if (stdout.length > 0) {
    response = JSON.parse(stdout) as Record<string, unknown>;
    // Exactly one pretty-printed JSON document, no noise.
    assert.equal(stdout, `${JSON.stringify(response, null, 2)}\n`);
    assert.equal(stdout.includes("\u001b["), false, "stdout must not contain ANSI escapes");
  }
  return { status: result.status, response, stdout, stderr };
}

function request(operation: string, extra: Record<string, unknown> = {}) {
  return { schemaVersion: DISCOVERY_API_SCHEMA_VERSION, operation, ...extra };
}

function errorCode(result: CliResult): string {
  assert.ok(result.response);
  const error = result.response.error as { code: string };
  return error.code;
}

describe("Discovery JSON end-to-end workflow", () => {
  it("completes questions → recommendations → validate → scaffold through the CLI", () => {
    const cwd = caseDir();
    const answers: Record<string, unknown> = {};
    let steps = 0;

    while (steps < 40) {
      const result = runJson(cwd, request("questions", { answers }));
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      const data = result.response?.data as {
        question: {
          id: string;
          type: string;
          options: { value: string }[];
        } | null;
        complete: boolean;
      };
      if (data.complete) break;
      const question = data.question;
      assert.ok(question);
      const value =
        question.id === "projectType"
          ? "server-api"
          : question.type === "multi-select"
            ? []
            : question.options[0]?.value;
      assert.ok(value !== undefined, `${question.id} has no options`);
      answers[question.id] = value;
      steps += 1;
    }
    assert.ok(steps < 40);

    const recommendations = runJson(cwd, request("recommendations", { answers }));
    assert.equal(recommendations.status, 0, recommendations.stderr);
    const recommendationData = recommendations.response?.data as {
      recommendedTemplateId: string | null;
      recommendedRecipeIds: string[];
    };
    assert.ok(recommendationData.recommendedTemplateId);
    const selection = {
      templateId: recommendationData.recommendedTemplateId,
      recipeIds: recommendationData.recommendedRecipeIds,
    };

    const validation = runJson(cwd, request("validate", { answers, selection }));
    assert.equal(validation.status, 0, validation.stderr);
    assert.ok(validation.response);
    assert.equal((validation.response.data as { valid: boolean }).valid, true);

    const scaffold = runJson(
      cwd,
      request("scaffold", {
        answers,
        selection,
        project: { name: "e2e-app" },
        confirmation: { confirmed: true },
      }),
    );
    assert.equal(scaffold.status, 0, scaffold.stderr);
    assert.equal(scaffold.stderr, "");
    assert.equal(scaffold.response?.ok, true);
    assert.equal(scaffold.response?.operation, "scaffold");

    const projectDir = path.join(cwd, "e2e-app");
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8")) as {
      name: string;
    };
    assert.equal(pkg.name, "e2e-app");
    assert.equal(fs.readlinkSync(path.join(projectDir, ".cursor")), ".agents");
  });
});

describe("Discovery JSON request hardening", () => {
  it("rejects unsupported schema versions and unknown operations", () => {
    const cwd = caseDir();
    const schema = runJson(cwd, { schemaVersion: 99, operation: "questions", answers: {} });
    assert.equal(schema.status, 2);
    assert.equal(errorCode(schema), "UNSUPPORTED_SCHEMA_VERSION");
    assert.equal(schema.response?.operation, "questions");

    const operation = runJson(cwd, request("nope"));
    assert.equal(operation.status, 2);
    assert.equal(errorCode(operation), "UNKNOWN_OPERATION");
    assert.equal(operation.stderr, "");
  });

  it("rejects empty, invalid, and structurally invalid input", () => {
    const cwd = caseDir();
    const empty = runJson(cwd, "");
    assert.equal(empty.status, 2);
    assert.equal(errorCode(empty), "INVALID_REQUEST");

    const malformed = runJson(cwd, "{nope");
    assert.equal(malformed.status, 2);
    assert.equal(errorCode(malformed), "INVALID_REQUEST");

    const nullAnswers = runJson(cwd, request("questions", { answers: null }));
    assert.equal(nullAnswers.status, 2);
    assert.equal(errorCode(nullAnswers), "INVALID_REQUEST");

    const badSelection = runJson(cwd, request("validate", { selection: [] }));
    assert.equal(badSelection.status, 2);
    assert.equal(errorCode(badSelection), "INVALID_SELECTION");
    assert.equal(badSelection.response?.operation, "validate");
  });

  it("rejects invalid answers without side effects", () => {
    const cwd = caseDir();
    const result = runJson(cwd, request("questions", { answers: { projectType: "nope" } }));
    assert.equal(result.status, 3);
    assert.equal(errorCode(result), "INVALID_ANSWERS");
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("rejects unknown templates and recipes", () => {
    const cwd = caseDir();
    const template = runJson(
      cwd,
      request("validate", { selection: { templateId: "nope", recipeIds: [] } }),
    );
    assert.equal(template.status, 3);
    assert.equal(errorCode(template), "UNKNOWN_TEMPLATE");

    const recipe = runJson(
      cwd,
      request("validate", { selection: { templateId: "nest", recipeIds: ["nope"] } }),
    );
    assert.equal(recipe.status, 3);
    assert.equal(errorCode(recipe), "UNKNOWN_RECIPE");
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("rejects incompatible recipe combinations without side effects", () => {
    const cwd = caseDir();
    const result = runJson(
      cwd,
      request("validate", { selection: { templateId: "vite-react", recipeIds: ["mui", "antd"] } }),
    );
    assert.equal(result.status, 3);
    const data = result.response?.data as { valid: boolean; errors: { code: string }[] };
    assert.equal(data.valid, false);
    assert.ok(data.errors.some((error) => error.code === "RECIPE_CONFLICT"));
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("rejects invalid project names and destinations", () => {
    const cwd = caseDir();
    const invalidName = runJson(
      cwd,
      request("scaffold", {
        selection: { templateId: "vite-react", recipeIds: [] },
        project: { name: "Bad Name" },
        confirmation: { confirmed: true },
      }),
    );
    assert.equal(invalidName.status, 2);
    assert.equal(errorCode(invalidName), "PROJECT_NAME_INVALID");

    const invalidDirectory = runJson(
      cwd,
      request("scaffold", {
        selection: { templateId: "vite-react", recipeIds: [] },
        project: { name: "my-app", directory: "other-dir" },
        confirmation: { confirmed: true },
      }),
    );
    assert.equal(invalidDirectory.status, 2);
    assert.equal(errorCode(invalidDirectory), "INVALID_PROJECT_DIRECTORY");
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("refuses an existing non-empty target without touching it", () => {
    const cwd = caseDir();
    fs.mkdirSync(path.join(cwd, "my-app"));
    fs.writeFileSync(path.join(cwd, "my-app", "keep.txt"), "user data");

    const result = runJson(
      cwd,
      request("scaffold", {
        selection: { templateId: "vite-react", recipeIds: [] },
        project: { name: "my-app" },
        confirmation: { confirmed: true },
      }),
    );
    assert.equal(result.status, 3);
    assert.equal(errorCode(result), "TARGET_EXISTS");
    assert.equal(fs.readFileSync(path.join(cwd, "my-app", "keep.txt"), "utf-8"), "user data");
  });

  it("returns SCAFFOLD_FAILED with exit 1 when commit fails", {
    skip:
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0),
  }, () => {
    const cwd = caseDir();
    fs.chmodSync(cwd, 0o500);
    try {
      const result = runJson(
        cwd,
        request("scaffold", {
          selection: { templateId: "vite-react", recipeIds: [] },
          project: { name: "my-app" },
          confirmation: { confirmed: true },
        }),
      );
      assert.equal(result.status, 1);
      assert.equal(errorCode(result), "SCAFFOLD_FAILED");
      assert.equal(result.stderr, "");
      assert.deepEqual(fs.readdirSync(cwd), []);
    } finally {
      fs.chmodSync(cwd, 0o700);
    }
  });

  it("keeps recommendations and validation read-only", () => {
    const cwd = caseDir();
    runJson(
      cwd,
      request("recommendations", {
        answers: { projectType: "server-api", apiStorageNeed: "none" },
      }),
    );
    runJson(cwd, request("validate", { selection: { templateId: "nest", recipeIds: [] } }));
    assert.deepEqual(fs.readdirSync(cwd), []);
  });
});
