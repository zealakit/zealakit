import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { ExitCode, PACKAGE_ROOT, ScaffoldValidationError, scaffoldProject } from "@zealakit/core";
import { exitCodeForError } from "../../apps/cli/src/create.js";
import { ScaffoldCommitError } from "../../packages/core/src/scaffold/commit.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-exit-code-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type RunOptions = { stdinMode?: "pipe" | "ignore" };

function runCli(args: string[], cwd: string, options: RunOptions = {}) {
  const { NO_COLOR: _, ...env } = process.env;
  const result = spawnSync(process.execPath, ["--import", TSX_LOADER, CLI_ENTRY, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...env, NO_COLOR: "1" },
    stdio: [options.stdinMode ?? "pipe", "pipe", "pipe"],
    timeout: 60_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("exitCodeForError", () => {
  it("maps validation errors to 3", () => {
    const error = new ScaffoldValidationError("Invalid recipe config", ["Unknown recipe 'nope'."]);
    assert.equal(exitCodeForError(error), ExitCode.VALIDATION);
    assert.equal(error.errors.length, 1);
  });

  it("maps unexpected and commit failures to 1", () => {
    assert.equal(exitCodeForError(new Error("boom")), ExitCode.INTERNAL);
    assert.equal(
      exitCodeForError(new ScaffoldCommitError("commit failed", { targetDir: "/tmp/app" })),
      ExitCode.INTERNAL,
    );
    assert.equal(exitCodeForError("boom"), ExitCode.INTERNAL);
  });
});

describe("scaffold error identity", () => {
  it("keeps preflight validation errors typed through scaffoldProject", async () => {
    const cwd = caseDir();
    await assert.rejects(
      () => scaffoldProject({ projectName: "app", templateId: "nope", recipeIds: [] }, cwd),
      (error: unknown) =>
        error instanceof ScaffoldValidationError &&
        error.errors.length > 0 &&
        /Unknown template/i.test(error.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, "app")), false);
  });

  it("does not classify filesystem failures as validation errors", () => {
    assert.equal(exitCodeForError(new Error("EACCES: permission denied")), ExitCode.INTERNAL);
  });
});

describe("create command exit codes", () => {
  it("returns 3 for invalid recipe configuration", () => {
    const cwd = caseDir();
    const result = runCli(["create", "demo-app", "-t", "vite-react", "-w", "nope", "-y"], cwd);
    assert.equal(result.status, ExitCode.VALIDATION);
    assert.equal(result.stdout, "");
    // Message is printed once (no duplicated prefix/title).
    assert.equal((result.stderr.match(/Unknown recipe/gi) ?? []).length, 1);
    assert.equal(fs.existsSync(path.join(cwd, "demo-app")), false);
  });

  it("returns 2 for invalid usage", () => {
    const result = runCli(["create", "-y"], caseDir());
    assert.equal(result.status, ExitCode.USAGE);
    assert.match(result.stderr, /requires a project name/i);
  });

  it("returns 2 for unknown options", () => {
    const result = runCli(["create", "--nope"], caseDir());
    assert.equal(result.status, ExitCode.USAGE);
    assert.match(result.stderr, /unknown option/i);
  });

  it("keeps --help and --version at 0", () => {
    assert.equal(runCli(["--help"], caseDir()).status, ExitCode.OK);
    assert.equal(runCli(["--version"], caseDir()).status, ExitCode.OK);
  });

  it("returns 0 for a successful create", () => {
    const cwd = caseDir();
    const result = runCli(["create", "my-app", "-t", "vite-react", "-y"], cwd);
    assert.equal(result.status, ExitCode.OK, result.stderr);
    assert.ok(fs.existsSync(path.join(cwd, "my-app", "package.json")));
  });

  it("returns 1 for filesystem failures", () => {
    const cwd = caseDir();
    fs.writeFileSync(path.join(cwd, "blocked"), "not a directory", "utf-8");
    const result = runCli(["create", "blocked", "-t", "vite-react", "-y"], cwd);
    assert.equal(result.status, ExitCode.INTERNAL);
    assert.notEqual(result.status, ExitCode.VALIDATION);
    assert.match(result.stderr, /ENOTDIR|not a directory/i);
  });

  it("returns 0 when the user cancels", () => {
    const cwd = caseDir();
    // Closed stdin behaves like an interactive cancel in @clack/prompts.
    const result = runCli(["create"], cwd, { stdinMode: "ignore" });
    assert.equal(result.status, ExitCode.OK);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("returns 0 when the user cancels the Discovery flow", () => {
    const cwd = caseDir();
    const result = runCli(["create", "--discover"], cwd, { stdinMode: "ignore" });
    assert.equal(result.status, ExitCode.OK);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });
});
