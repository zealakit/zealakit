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
import { forceColorEnv, noColorEnv } from "../helpers/env.js";

const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

/** Colors are forced on to prove the JSON path never emits them. */
function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    cwd: PACKAGE_ROOT,
    encoding: "utf-8",
    env: forceColorEnv(),
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
    assert.ok(response.data.recipes.length > 0);
    assert.ok(response.data.recipes.every((recipe) => recipe.ecosystem === "go"));
    assert.deepEqual(
      response.data.ecosystems.map((ecosystem) => ecosystem.id),
      ["go"],
    );
  });

  it("filters by Discovery capability", () => {
    const result = runCli(["info", "--json", "--capability", "database"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(response.filters, { capability: "database" });
    assert.deepEqual(response.data.templates, []);
    assert.ok(response.data.recipes.length > 0);
    assert.ok(response.data.recipes.some((recipe) => recipe.id === "postgres"));
    assert.ok(
      response.data.recipes.every(
        (recipe) =>
          recipe.categories.includes("orm") || recipe.id === "postgres" || recipe.id === "mysql",
      ),
    );
    assert.deepEqual(
      response.data.capabilities.map((capability) => capability.id),
      ["database"],
    );
    assert.equal(response.schemaVersion, INFO_SCHEMA_VERSION);
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

  it("rejects invalid filters on stderr with exit 2 and empty stdout", () => {
    const result = runCli(["info", "--json", "--scope", "desktop"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Unknown scope 'desktop'/);
  });

  it("rejects unknown ecosystem, template and recipe ids", () => {
    for (const args of [
      ["info", "--json", "--ecosystem", "deno"],
      ["info", "--json", "--template", "nope"],
      ["info", "--json", "--recipe", "nope"],
      ["info", "--json", "--capability", "magic"],
    ]) {
      const result = runCli(args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.length > 0, `${args.join(" ")} should report on stderr`);
    }
  });
});

describe("zealakit info (human output)", () => {
  it("keeps the human-readable summary", () => {
    const result = runCli(["info"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Templates/);
    assert.match(result.stdout, /Recipes/);
    assert.doesNotMatch(result.stdout, /^\s*\{/);
  });

  it("reports invalid filters on stderr without stdout", () => {
    const result = runCli(["info", "--scope", "desktop"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Unknown scope/);
  });

  it("rejects unknown options as usage errors", () => {
    const result = runCli(["info", "--nope"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown option/);
  });
});

describe("info --json without a TTY", () => {
  it("writes only JSON and needs no input", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, "info", "--json"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf-8",
      env: noColorEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    assert.equal(result.status, 0, result.stderr ?? "");
    assert.equal(result.stderr, "");
    const data = JSON.parse(result.stdout ?? "") as InfoResponse;
    assert.equal(data.schemaVersion, INFO_SCHEMA_VERSION);
    assert.deepEqual(data, buildInfoResponse());
  });

  it("is deterministic across repeated invocations", () => {
    const first = runCli(["info", "--json"]);
    const second = runCli(["info", "--json"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(first.stdout, second.stdout);
  });

  it("applies filters in a non-TTY environment", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        CLI_ENTRY,
        "info",
        "--json",
        "--discover",
        "--ecosystem",
        "node",
        "--scope",
        "server",
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: "utf-8",
        env: noColorEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      },
    );
    assert.equal(result.status, 0, result.stderr ?? "");
    assert.equal(result.stderr, "");
    const response = JSON.parse(result.stdout ?? "") as InfoResponse;
    assert.ok(response.data.templates.length > 0);
    assert.ok(
      response.data.templates.every(
        (template) => template.ecosystem === "node" && template.scope === "server",
      ),
    );
    for (const template of response.data.templates) {
      assert.equal(template.discovery?.id, template.id);
    }
    for (const recipe of response.data.recipes) {
      assert.equal(recipe.discovery?.id, recipe.id);
    }
  });
});

describe("info discovery metadata filtering", () => {
  it("includes only Discovery profiles for the filtered result", () => {
    const result = runCli(["info", "--json", "--discover", "--template", "next"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    assert.deepEqual(
      response.data.templates.map((template) => template.id),
      ["next"],
    );
    assert.equal(response.data.templates[0]?.discovery?.id, "next");
    for (const recipe of response.data.recipes) {
      assert.equal(recipe.discovery?.id, recipe.id);
      assert.deepEqual(recipe.templates, ["next"]);
    }
  });

  it("does not run Discovery scoring or ranking", () => {
    const result = runCli(["info", "--json", "--discover", "--scope", "server"]);
    assert.equal(result.status, 0, result.stderr);
    const response = parseJson(result.stdout);
    const forbidden = new Set([
      "score",
      "reasons",
      "recommendedTemplateId",
      "recommendedRecipeIds",
    ]);
    const hasForbiddenKey = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(hasForbiddenKey);
      if (value !== null && typeof value === "object") {
        return Object.entries(value).some(
          ([key, entry]) => forbidden.has(key) || hasForbiddenKey(entry),
        );
      }
      return false;
    };
    assert.equal(hasForbiddenKey(response), false);
  });

  it("filters the human-readable summary without changing its format", () => {
    const result = runCli(["info", "--scope", "server"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Filters/);
    assert.match(result.stdout, /nest/);
    assert.doesNotMatch(result.stdout, /vite-react/);
  });

  it("supports --discover in human mode with a note", () => {
    const result = runCli(["info", "--discover"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Discovery profiles included/);
  });
});
