import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  buildScaffoldPlan,
  type RecipeConfig,
  registerRecipe,
  type ScaffoldConfig,
  scaffoldProject,
  validateGeneratedOutput,
} from "@zealakit/core";

/**
 * Synthetic recipes registered in this file only (Node runs test files in
 * separate processes). They reuse real recipe folders so the real copy
 * pipeline runs, while letting us exercise `dependsOn` (no shipped recipe has
 * dependencies today).
 */
function syntheticRecipe(
  id: string,
  dependsOn: string[],
  recipePath: string,
  packages: Record<string, string>,
  scripts: Record<string, string>,
): RecipeConfig {
  return {
    id,
    name: `Synthetic ${id}`,
    category: "utils",
    supportedScopes: "all",
    dependsOn,
    packages,
    devDependencies: {},
    scripts,
    path: recipePath,
  };
}

registerRecipe(
  syntheticRecipe(
    "e2e-base",
    [],
    "node/biome",
    { "e2e-base-lib": "^1.0.0" },
    {
      "e2e:base": "echo base",
    },
  ),
);
registerRecipe(
  syntheticRecipe(
    "e2e-leaf",
    ["e2e-base"],
    "node/eslint",
    { "e2e-leaf-lib": "^2.0.0" },
    {
      "e2e:leaf": "echo leaf",
    },
  ),
);
registerRecipe(
  syntheticRecipe(
    "e2e-root",
    ["e2e-leaf"],
    "node/axios",
    { "e2e-root-lib": "^3.0.0" },
    {
      "e2e:root": "echo root",
    },
  ),
);
registerRecipe(
  syntheticRecipe("e2e-conflict-a", [], "node/eslint", { "e2e-shared-lib": "^1.0.0" }, {}),
);
registerRecipe(
  syntheticRecipe("e2e-conflict-b", [], "node/biome", { "e2e-shared-lib": "^2.0.0" }, {}),
);

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-deps-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function baseConfig(recipeIds: string[]): ScaffoldConfig {
  return { projectName: "app-deps", templateId: "vite-react", recipeIds };
}

describe("recipe dependency resolution in the real pipeline", () => {
  it("expands transitive dependsOn in dependency-first order", () => {
    const cwd = caseDir();
    const plan = buildScaffoldPlan(baseConfig(["e2e-root"]), cwd);
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.config.recipeIds, ["e2e-base", "e2e-leaf", "e2e-root"]);
    assert.deepEqual(plan.autoInjected, ["e2e-base", "e2e-leaf"]);
  });

  it("applies every dependency and its manifest contributions", async () => {
    const cwd = caseDir();
    const config = baseConfig(["e2e-root"]);
    const dir = await scaffoldProject(config, cwd);

    assert.deepEqual(validateGeneratedOutput(dir, config), { ok: true, errors: [] });
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    assert.equal(pkg.dependencies["e2e-base-lib"], "^1.0.0");
    assert.equal(pkg.dependencies["e2e-leaf-lib"], "^2.0.0");
    assert.equal(pkg.dependencies["e2e-root-lib"], "^3.0.0");
    assert.equal(pkg.scripts["e2e:base"], "echo base");
    assert.equal(pkg.scripts["e2e:leaf"], "echo leaf");
    assert.equal(pkg.scripts["e2e:root"], "echo root");
  });

  it("deduplicates repeated selections before materializing", () => {
    const plan = buildScaffoldPlan(baseConfig(["e2e-base", "e2e-base", "e2e-leaf"]), caseDir());
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.config.recipeIds, ["e2e-base", "e2e-leaf"]);
  });

  it("rejects conflicting manifest contributions before writing", async () => {
    const cwd = caseDir();
    const config = baseConfig(["e2e-conflict-a", "e2e-conflict-b"]);
    const plan = buildScaffoldPlan(config, cwd);
    assert.ok(plan.blockers.some((blocker) => /Package conflict/.test(blocker)));

    await assert.rejects(
      () => scaffoldProject(config, cwd),
      (error: unknown) => error instanceof Error && /Package conflict/.test(error.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, config.projectName)), false);
  });
});
