import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  checkProject,
  compareKitVersions,
  PACKAGE_ROOT,
  scaffoldProject,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-project-doctor-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
async function project(templateId: string, scope: "client" | "server", recipes: string[] = []) {
  return scaffoldProject(
    { projectName: `p-${++counter}`, templateId, recipeIds: withDefaultRecipes(scope, recipes) },
    path.join(workRoot, `case-${counter}`),
  );
}

const status = (dir: string, id: string) =>
  checkProject(dir).checks.find((check) => check.id === id);

describe("compareKitVersions", () => {
  it("orders releases and prereleases", () => {
    assert.ok(compareKitVersions("1.0.0-beta.3", "1.0.0-beta.4") < 0);
    assert.ok(compareKitVersions("1.0.0-beta.10", "1.0.0-beta.4") > 0);
    assert.ok(compareKitVersions("1.0.0", "1.0.0-beta.9") > 0);
    assert.ok(compareKitVersions("1.1.0", "1.0.9") > 0);
    assert.equal(compareKitVersions("1.0.0-beta.4", "1.0.0-beta.4"), 0);
  });
});

describe("checkProject", () => {
  it("ignores directories without zealakit.json", () => {
    const report = checkProject(fs.mkdtempSync(path.join(workRoot, "plain-")));
    assert.equal(report.isZealakitProject, false);
    assert.deepEqual(report.checks, []);
  });

  it("passes on a fresh project and reports missing dependencies as info", async () => {
    const dir = await project("vite-react", "client", ["biome"]);
    const report = checkProject(dir);
    assert.ok(report.checks.every((check) => check.status !== "fail"));
    assert.equal(status(dir, "dependencies")?.status, "info");
    assert.equal(status(dir, "agent-docs")?.status, "ok");
    assert.equal(status(dir, "recipe-files")?.status, "ok");
  });

  it("fails on an invalid manifest", async () => {
    const dir = await project("vite-react", "client");
    fs.writeFileSync(path.join(dir, "zealakit.json"), "{}");
    assert.equal(status(dir, "manifest")?.status, "fail");
  });

  it("warns about a newer project and removed recipe files", async () => {
    const dir = await project("vite-react", "client", ["biome"]);
    const file = path.join(dir, "zealakit.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf-8"));
    manifest.kitVersion = "9.0.0";
    fs.writeFileSync(file, JSON.stringify(manifest));
    fs.rmSync(path.join(dir, "biome.json"));
    assert.equal(status(dir, "kit-version")?.status, "warn");
    assert.equal(status(dir, "recipe-files")?.status, "warn");
  });

  it("fails when .cursor is not a symlink to .agents", async () => {
    const dir = await project("vite-react", "client");
    fs.rmSync(path.join(dir, ".cursor"), { recursive: true, force: true });
    assert.equal(status(dir, "agent-docs")?.status, "fail");
  });

  it("compares .env with .env.example (Go postgres)", async () => {
    const dir = await project("stdlib-api", "server", ["postgres"]);
    assert.equal(status(dir, "env")?.status, "warn");
    fs.writeFileSync(path.join(dir, ".env"), "APP_NAME=x\n");
    assert.match(status(dir, "env")?.message ?? "", /missing: .*DATABASE_URL/);
    fs.copyFileSync(path.join(dir, ".env.example"), path.join(dir, ".env"));
    assert.equal(status(dir, "env")?.status, "ok");
    assert.equal(status(dir, "dependencies")?.status, "ok"); // the postgres recipe ships go.sum
  });
});

describe("zealakit doctor in a project", () => {
  it("adds a project section to --json and exits 3 on a failing check", async () => {
    const dir = await project("vite-react", "client");
    const run = () =>
      spawnSync(
        process.execPath,
        ["--import", TSX_LOADER, CLI_ENTRY, "doctor", "--json", "--cwd", dir],
        {
          encoding: "utf-8",
          env: noColorEnv(),
          timeout: 60_000,
        },
      );
    const ok = run();
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).project.isZealakitProject, true);

    fs.rmSync(path.join(dir, ".cursor"), { recursive: true, force: true });
    assert.equal(run().status, 3);
  });
});
