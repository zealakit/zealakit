import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { PACKAGE_ROOT } from "@zealakit/core/internal";

import { noColorEnv } from "../helpers/env.js";
import { validateJsonSchema } from "../helpers/json-schema.js";

/**
 * Stability contract: every machine-readable output validates against the
 * JSON Schema shipped in `schema/`. A failure here is a contract change and
 * needs a CHANGELOG "Breaking" note (docs/stability.md).
 */

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-contract-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));
let counter = 0;

function schema(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "schema", `${name}.schema.json`), "utf-8"),
  );
}

function run(args: string[], options: { cwd?: string; input?: string } = {}) {
  const cwd = options.cwd ?? fs.mkdtempSync(path.join(workRoot, `case-${++counter}-`));
  const result = spawnSync(process.execPath, ["--import", TSX_LOADER, CLI_ENTRY, ...args], {
    cwd,
    encoding: "utf-8",
    env: noColorEnv(),
    input: options.input,
    timeout: 60_000,
  });
  return { cwd, status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function expectValid(name: string, value: unknown): void {
  assert.deepEqual(validateJsonSchema(value, schema(name)), [], `${name} schema`);
}

describe("JSON output contracts", () => {
  it("info --json", () => {
    expectValid("info", JSON.parse(run(["info", "--json"]).stdout));
  });

  it("doctor --json (plain and inside a project)", () => {
    expectValid("doctor", JSON.parse(run(["doctor", "--json"]).stdout));
    const created = run(["create", "contract-app", "-t", "vite-react", "-w", "biome", "-y"]);
    assert.equal(created.status, 0, created.stderr);
    const project = path.join(created.cwd, "contract-app");
    const inProject = JSON.parse(run(["doctor", "--json", "--cwd", project]).stdout);
    assert.ok(inProject.project);
    expectValid("doctor", inProject);
  });

  it("create --json success, failure and dry-run", () => {
    const ok = run(["create", "a", "-t", "vite-react", "-w", "biome", "-y", "--json"]);
    expectValid("create-result", JSON.parse(ok.stdout));
    const bad = run(["create", "a", "-t", "vite-react", "-w", "biome,eslint", "-y", "--json"]);
    assert.equal(bad.status, 3);
    expectValid("create-result", JSON.parse(bad.stdout));
    const dry = run(["create", "a", "-t", "vite-react", "--dry-run", "--json"]);
    expectValid("create-plan", JSON.parse(dry.stdout));
  });

  it("add --json (dry-run, applied, failure)", () => {
    const created = run(["create", "p", "-t", "vite-react", "-y"]);
    const project = path.join(created.cwd, "p");
    expectValid(
      "add-result",
      JSON.parse(run(["add", "zustand", "--dry-run", "--json"], { cwd: project }).stdout),
    );
    expectValid(
      "add-result",
      JSON.parse(run(["add", "zustand", "-y", "--force", "--json"], { cwd: project }).stdout),
    );
    const bad = run(["add", "nope", "-y", "--json"], { cwd: project });
    expectValid("add-result", JSON.parse(bad.stdout));
  });

  it("outdated --json", () => {
    const created = run(["create", "o", "-t", "vite-react", "-y"]);
    const project = path.join(created.cwd, "o");
    expectValid("outdated", JSON.parse(run(["outdated", "--json"], { cwd: project }).stdout));
    const missing = run(["outdated", "--json"]);
    assert.equal(missing.status, 3);
    expectValid("outdated", JSON.parse(missing.stdout));
  });

  it("Discovery JSON API success and error envelopes", () => {
    const ok = run(["create", "--discover", "--json"], {
      input: JSON.stringify({ schemaVersion: 1, operation: "questions", answers: {} }),
    });
    expectValid("discovery-response", JSON.parse(ok.stdout));
    const bad = run(["create", "--discover", "--json"], {
      input: JSON.stringify({ schemaVersion: 99, operation: "questions", answers: {} }),
    });
    const parsed = JSON.parse(bad.stdout);
    assert.equal(parsed.ok, false);
    expectValid("discovery-response", parsed);
  });

  it("discovery query reads the same contract", () => {
    const out = run(["discovery", "query"], {
      input: JSON.stringify({ schemaVersion: 1, operation: "questions", answers: {} }),
    });
    expectValid("discovery-response", JSON.parse(out.stdout));
  });
});
