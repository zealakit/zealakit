import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { buildScaffoldPlan, PACKAGE_ROOT, planIsReady, withDefaultRecipes } from "@zealakit/core";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-plan-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

describe("buildScaffoldPlan", () => {
  it("is ready for a known-good stack without writing files", () => {
    const before = fs.readdirSync(workRoot);
    const plan = buildScaffoldPlan(
      {
        projectName: "preview-app",
        templateId: "vite-react",
        recipeIds: withDefaultRecipes("client", ["biome", "zustand"]),
      },
      workRoot,
    );
    assert.equal(planIsReady(plan), true, plan.blockers.join("\n"));
    assert.ok(plan.files.length > 0);
    assert.ok(plan.packages.addedDevDependencies.includes("@biomejs/biome"));
    assert.deepEqual(fs.readdirSync(workRoot), before);
  });

  it("blocks exclusive conflicts before any write", () => {
    const plan = buildScaffoldPlan(
      {
        projectName: "bad-app",
        templateId: "vite-react",
        recipeIds: ["biome", "eslint"],
      },
      workRoot,
    );
    assert.equal(planIsReady(plan), false);
    assert.ok(plan.blockers.some((b) => /conflict/i.test(b)));
  });

  it("marks default recipes as auto-injected when already applied via withDefaultRecipes", () => {
    const plan = buildScaffoldPlan(
      {
        projectName: "defaults-app",
        templateId: "next",
        recipeIds: withDefaultRecipes("hybrid", ["biome"]),
      },
      workRoot,
    );
    assert.ok(plan.config.recipeIds.includes("client-shared-pieces"));
    assert.equal(planIsReady(plan), true, plan.blockers.join("\n"));
  });

  it("warns when ORM is selected on a hybrid template", () => {
    const plan = buildScaffoldPlan(
      {
        projectName: "hybrid-orm",
        templateId: "next",
        recipeIds: withDefaultRecipes("hybrid", ["prisma"]),
      },
      workRoot,
    );
    assert.equal(planIsReady(plan), true, plan.blockers.join("\n"));
    assert.ok(plan.warnings.some((w) => /Hybrid apps|small projects/i.test(w)));
    assert.ok(plan.warnings.some((w) => /prisma/.test(w)));
  });
});

describe("zealakit --dry-run", () => {
  function runDryRun(args: string[]) {
    const { NO_COLOR: _, ...env } = process.env;
    return spawnSync(
      process.execPath,
      ["--import", "tsx", path.join(PACKAGE_ROOT, "apps/cli/src/index.ts"), ...args],
      {
        cwd: PACKAGE_ROOT,
        encoding: "utf-8",
        env: { ...env, FORCE_COLOR: "0", NO_COLOR: "1" },
      },
    );
  }

  it("prints a preview and writes nothing", () => {
    const name = `dry-run-cli-${Date.now()}`;
    const target = path.join(PACKAGE_ROOT, name);
    const result = runDryRun([name, "-t", "vite-react", "-w", "biome", "--dry-run"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generation Preview/);
    assert.match(result.stdout, /Ready to scaffold/);
    assert.match(result.stdout, /No files were written/);
    assert.equal(fs.existsSync(target), false);
  });

  it("exits 3 when the plan has blockers", () => {
    const result = runDryRun([
      "dry-run-bad",
      "-t",
      "vite-react",
      "-w",
      "biome,eslint",
      "--dry-run",
    ]);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stdout, /Cannot scaffold/);
  });
});
