import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import {
  getRecipeIncompatibility,
  INFO_SCHEMA_VERSION,
  PACKAGE_ROOT,
  RECIPE_CATEGORIES,
  recipes,
  templates,
} from "@zealakit/core";
import { buildInfoResponse, type InfoResponse } from "../../apps/cli/src/info.js";
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

function parseJson(stdout: string): InfoResponse {
  return JSON.parse(stdout) as InfoResponse;
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
      const data = parseJson(result.stdout);
      assert.equal(result.stdout, `${JSON.stringify(data, null, 2)}\n`);
      assert.ok(!result.stdout.includes("\u001b["), "no ANSI colors");
      assert.deepEqual(data, buildInfoResponse());
    });

    it("uses the versioned info envelope", () => {
      const data = parseJson(result.stdout);
      assert.equal(data.schemaVersion, INFO_SCHEMA_VERSION);
      assert.equal(data.command, "info");
      assert.deepEqual(data.filters, {});
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

describe("buildInfoResponse", () => {
  const response = buildInfoResponse();

  it("exposes CLI metadata from package.json", () => {
    const manifest = readKitManifest();
    assert.equal(response.schemaVersion, INFO_SCHEMA_VERSION);
    assert.equal(response.data.cli?.name, manifest.name);
    assert.equal(response.data.cli?.version, manifest.version);
    assert.equal(response.data.defaults.templateId, "vite-react");
    assert.equal(response.data.defaults.noneValue, "none");
  });

  it("lists every template, category and recipe from the registry", () => {
    assert.deepEqual(
      response.data.templates.map((template) => template.id),
      Object.keys(templates),
    );
    assert.deepEqual(
      response.data.categories.map((category) => category.id),
      [...RECIPE_CATEGORIES],
    );
    assert.deepEqual(
      response.data.recipes.map((recipe) => recipe.id),
      Object.keys(recipes),
    );
  });

  it("matches compat for every recipe × template", () => {
    for (const recipe of response.data.recipes) {
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
          response.data.templates
            .find((entry) => entry.id === template.id)
            ?.compatibleRecipes.includes(recipe.id),
          compatible,
        );
      }
    }
  });

  it("only offers compatible recipes in prompt steps", () => {
    for (const template of response.data.templates) {
      for (const step of template.promptSteps) {
        assert.ok(step.options.length > 0);
        for (const option of step.options) {
          assert.ok(template.compatibleRecipes.includes(option), `${template.id}: ${option}`);
        }
      }
    }
  });

  it("encodes exclusivity, coexistence and auto-inject rules", () => {
    const ui = response.data.categories.find((category) => category.id === "ui");
    assert.equal(ui?.exclusive, true);
    assert.equal(ui?.required, false);
    assert.ok(ui?.nonExclusiveRecipes.includes("storybook"));

    const storybook = response.data.recipes.find((recipe) => recipe.id === "storybook");
    assert.deepEqual(storybook?.conflictsWith, []);
    assert.ok(
      response.data.recipes.find((recipe) => recipe.id === "mui")?.conflictsWith.includes("antd"),
    );

    const nest = response.data.templates.find((template) => template.id === "nest");
    const next = response.data.templates.find((template) => template.id === "next");
    assert.deepEqual(nest?.defaultRecipes, []);
    assert.deepEqual(next?.defaultRecipes, ["client-shared-pieces"]);
    assert.ok(response.data.categories.find((category) => category.id === "utils")?.auto);

    assert.deepEqual(
      response.data.rules.map((rule) => rule.id),
      [
        "scope-match",
        "hybrid-orm-caveat",
        "ui-framework-match",
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

  it("omits Discovery profiles unless requested", () => {
    assert.ok(response.data.templates.every((template) => template.discovery === undefined));
    assert.ok(response.data.recipes.every((recipe) => recipe.discovery === undefined));
  });

  it("includes Discovery profiles with --discover", () => {
    const discovery = buildInfoResponse({ discover: true });
    assert.equal(discovery.filters.discovery, true);
    assert.ok(discovery.data.templates.every((template) => template.discovery?.id === template.id));
    assert.ok(discovery.data.recipes.every((recipe) => recipe.discovery?.id === recipe.id));
  });
});

describe("zealakit info filters", () => {
  it("filters by scope and keeps relation ids consistent", () => {
    const result = runCli(["info", "--json", "--scope", "server"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(response.filters, { scope: "server" });
    assert.ok(response.data.templates.length > 0);
    assert.ok(response.data.templates.every((template) => template.scope === "server"));
    const visible = new Set(response.data.recipes.map((recipe) => recipe.id));
    for (const recipe of response.data.recipes) {
      assert.ok(recipe.supportedScopes === "all" || recipe.supportedScopes.includes("server"));
      assert.ok(recipe.templates.every((id) => response.data.templates.some((t) => t.id === id)));
    }
    for (const template of response.data.templates) {
      assert.ok(template.compatibleRecipes.every((id) => visible.has(id)));
    }
  });

  it("filters by ecosystem", () => {
    const result = runCli(["info", "--json", "--ecosystem", "go"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(
      response.data.templates.map((template) => template.ecosystem),
      ["go", "go", "go"],
    );
    assert.deepEqual(response.data.recipes, []);
    assert.deepEqual(
      response.data.ecosystems.map((ecosystem) => ecosystem.id),
      ["go"],
    );
  });

  it("filters by template id", () => {
    const result = runCli(["info", "--json", "--template", "nest"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(
      response.data.templates.map((template) => template.id),
      ["nest"],
    );
    for (const recipe of response.data.recipes) {
      assert.deepEqual(recipe.templates, ["nest"]);
    }
    assert.ok(!response.data.recipes.some((recipe) => recipe.id === "shadcn-ui"));
  });

  it("filters by recipe id and combined filters", () => {
    const result = runCli([
      "info",
      "--json",
      "--ecosystem",
      "node",
      "--scope",
      "server",
      "--category",
      "orm",
      "--recipe",
      "prisma",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(
      response.data.recipes.map((recipe) => recipe.id),
      ["prisma"],
    );
    assert.deepEqual(
      response.data.templates.map((template) => template.id),
      ["nest", "hono"],
    );
    assert.deepEqual(
      response.data.categories.map((category) => category.id),
      ["orm"],
    );
  });

  it("returns empty sections for contradictory filters", () => {
    const result = runCli(["info", "--json", "--ecosystem", "go", "--recipe", "biome"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(response.data.templates, []);
    assert.deepEqual(response.data.recipes, []);
    assert.ok(response.data.categories.every((category) => category.recipes.length === 0));
  });

  it("rejects invalid filters with machine-readable JSON and exit 2", () => {
    const result = runCli(["info", "--json", "--scope", "desktop"]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    assert.ok(!result.stdout.includes("\u001b["), "no ANSI colors");
    const error = JSON.parse(result.stdout) as {
      schemaVersion: number;
      command: string;
      error: { code: string; details: string[] };
    };
    assert.equal(error.schemaVersion, INFO_SCHEMA_VERSION);
    assert.equal(error.command, "info");
    assert.equal(error.error.code, "invalid-filter");
    assert.ok(error.error.details.some((detail) => detail.includes("desktop")));
  });

  it("rejects unknown template and recipe ids", () => {
    for (const args of [
      ["info", "--json", "--template", "nope"],
      ["info", "--json", "--recipe", "nope"],
    ]) {
      const result = runCli(args);
      assert.equal(result.status, 2, args.join(" "));
      const error = JSON.parse(result.stdout) as { error: { code: string } };
      assert.equal(error.error.code, "invalid-filter");
    }
  });
});
