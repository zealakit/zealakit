import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import {
  getRecipeIncompatibility,
  PACKAGE_ROOT,
  RECIPE_CATEGORIES,
  recipes,
  templates,
} from "@zealakit/core";
import { buildKitInfo, INFO_SCHEMA_VERSION, type KitInfo } from "../../apps/cli/src/info.js";
import { readKitManifest } from "../../apps/cli/src/manifest.js";

const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

/** Colors are forced on to prove the JSON path never emits them. */
function runCli(args: string[]) {
  const { NO_COLOR: _, ...env } = process.env;
  return spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    cwd: PACKAGE_ROOT,
    encoding: "utf-8",
    env: { ...env, FORCE_COLOR: "1" },
  });
}

for (const args of [
  ["info", "--json"],
  ["--info", "--json"],
]) {
  describe(`zealakit ${args.join(" ")}`, () => {
    const result = runCli(args);

    it("exits 0 with empty stderr", () => {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
    });

    it("writes only JSON.stringify(data, null, 2) to stdout", () => {
      const data = JSON.parse(result.stdout) as KitInfo;
      assert.equal(result.stdout, `${JSON.stringify(data, null, 2)}\n`);
      assert.ok(!result.stdout.includes("\u001b["), "no ANSI colors");
      assert.deepEqual(data, buildKitInfo());
    });
  });
}

describe("zealakit --json without --info", () => {
  it("fails instead of scaffolding", () => {
    const result = runCli(["--json"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
  });
});

describe("buildKitInfo", () => {
  const info = buildKitInfo();

  it("exposes CLI metadata from package.json", () => {
    const manifest = readKitManifest();
    assert.equal(info.schemaVersion, INFO_SCHEMA_VERSION);
    assert.equal(info.cli.name, manifest.name);
    assert.equal(info.cli.version, manifest.version);
  });

  it("lists every template, category and recipe from the registry", () => {
    assert.deepEqual(
      info.templates.map((t) => t.id),
      Object.keys(templates),
    );
    assert.deepEqual(
      info.categories.map((c) => c.id),
      [...RECIPE_CATEGORIES],
    );
    assert.deepEqual(
      info.recipes.map((r) => r.id),
      Object.keys(recipes),
    );
  });

  it("matches compat for every recipe × template", () => {
    for (const recipe of info.recipes) {
      const config = recipes[recipe.id];
      assert.ok(config);
      for (const template of Object.values(templates)) {
        const compatible: boolean = getRecipeIncompatibility(config, template) === undefined;
        assert.equal(
          recipe.templates.includes(template.id),
          compatible,
          `${recipe.id} × ${template.id}`,
        );
        assert.equal(
          info.templates.find((t) => t.id === template.id)?.compatibleRecipes.includes(recipe.id),
          compatible,
        );
      }
    }
  });

  it("only offers compatible recipes in prompt steps", () => {
    for (const template of info.templates) {
      for (const step of template.promptSteps) {
        assert.ok(step.options.length > 0);
        for (const option of step.options) {
          assert.ok(template.compatibleRecipes.includes(option), `${template.id}: ${option}`);
        }
      }
    }
  });

  it("encodes exclusivity, coexistence and auto-inject rules", () => {
    const ui = info.categories.find((c) => c.id === "ui");
    assert.equal(ui?.exclusive, true);
    assert.equal(ui?.required, false);
    assert.ok(ui?.nonExclusiveRecipes.includes("storybook"));

    const storybook = info.recipes.find((r) => r.id === "storybook");
    assert.deepEqual(storybook?.conflictsWith, []);
    assert.ok(info.recipes.find((r) => r.id === "mui")?.conflictsWith.includes("antd"));

    const nest = info.templates.find((t) => t.id === "nest");
    const next = info.templates.find((t) => t.id === "next");
    assert.deepEqual(nest?.defaultRecipes, []);
    assert.deepEqual(next?.defaultRecipes, ["client-shared-pieces"]);
    assert.ok(info.categories.find((c) => c.id === "utils")?.auto);

    assert.deepEqual(
      info.rules.map((r) => r.id),
      [
        "scope-match",
        "hybrid-orm-caveat",
        "framework-match",
        "overlay-required",
        "exclusive-per-category",
        "non-exclusive-coexist",
        "default-recipes",
        "recipe-dependencies",
      ],
    );

    const ormStep = next?.promptSteps.find(
      (step) => step.kind === "select" && step.category === "orm",
    );
    assert.ok(ormStep && ormStep.kind === "select");
    assert.ok(ormStep.notice);
    assert.ok(ormStep.options.includes("prisma"));
  });
});
