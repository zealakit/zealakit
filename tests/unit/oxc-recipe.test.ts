import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAllTemplateIds,
  getRecipe,
  getNpmManifest,
  getRecipeCategories,
  getStepInitialValue,
  getStepOptions,
  getTemplate,
  STEPS_BY_SCOPE,
} from "@zealakit/core/internal";

import { expectRejected, scaffold } from "../helpers/scaffold.js";

type OxcLintConfig = {
  plugins: string[];
  env: Record<string, boolean>;
  rules?: Record<string, string>;
  ignorePatterns: string[];
};

type OxcFormatConfig = {
  printWidth: number;
  sortImports: { newlinesBetween: boolean } | boolean;
  sortPackageJson: boolean;
  sortTailwindcss?: boolean;
  ignorePatterns: string[];
};

const EXPECTED: Record<string, { plugins: string[]; browser: boolean }> = {
  "vite-react": { plugins: ["react", "jsx-a11y", "react-perf"], browser: true },
  "astro-react-client": { plugins: ["react", "jsx-a11y", "react-perf"], browser: true },
  "astro-react-hybrid": { plugins: ["react", "jsx-a11y"], browser: true },
  next: { plugins: ["react", "jsx-a11y", "nextjs"], browser: true },
  "vite-vue": { plugins: ["vue"], browser: true },
  nuxt: { plugins: ["vue"], browser: true },
  "vite-svelte": { plugins: [], browser: true },
  nest: { plugins: ["node", "vitest"], browser: false },
  hono: { plugins: ["node", "vitest"], browser: false },
};

describe("oxc recipe", () => {
  it("is an exclusive linter recipe", () => {
    const recipe = getRecipe("oxc");
    assert.ok(recipe);
    assert.deepEqual(getRecipeCategories(recipe), ["linter"]);
    assert.equal(recipe.exclusive, true);
    assert.deepEqual(recipe.supportedScopes, ["client", "server", "hybrid"]);
    assert.equal(recipe.discovery?.alwaysRelevant, true);
    const npm = getNpmManifest(recipe);
    assert.ok(npm);
    assert.deepEqual(npm.devDependencies, {
      oxlint: "^1.94.0",
      oxfmt: "~0.79.0",
    });
    assert.deepEqual(npm.scripts, {
      lint: "oxlint",
      "lint:fix": "oxlint --fix",
      fmt: "oxfmt",
      "fmt:check": "oxfmt --check",
      check: "oxlint && oxfmt --check",
      "check:write": "oxlint --fix && oxfmt",
    });
  });

  it("is the prompt default and ranked first by Discovery", () => {
    const template = getTemplate("vite-react");
    assert.ok(template);
    const step = STEPS_BY_SCOPE.client.find(
      (candidate) => candidate.kind === "select" && candidate.category === "linter",
    );
    assert.ok(step);
    const options = getStepOptions(step, template);
    assert.equal(options[0]?.id, "oxc");
    assert.equal(getStepInitialValue(step, options), "oxc");
  });

  it("ships an overlay for every Node template", () => {
    for (const templateId of getAllTemplateIds()) {
      const template = getTemplate(templateId);
      if (!template || (template.ecosystem ?? "node") !== "node") continue;
      assert.ok(templateId in EXPECTED, `${templateId} has no expected oxc overlay`);
    }
  });

  for (const [templateId, expected] of Object.entries(EXPECTED)) {
    it(`${templateId}: lint plugins, env and scripts`, async () => {
      const app = await scaffold(templateId, ["oxc"]);
      assert.ok(app.exists(".oxlintrc.json"));
      assert.ok(app.exists(".oxfmtrc.json"));
      const lint = app.json<OxcLintConfig>(".oxlintrc.json");
      for (const plugin of ["typescript", "unicorn", "oxc", "import", ...expected.plugins]) {
        assert.ok(lint.plugins.includes(plugin), `${templateId}: plugin ${plugin}`);
      }
      assert.equal(lint.env.browser, expected.browser || undefined, templateId);
      assert.equal(lint.env.node, expected.browser ? undefined : true, templateId);
      assert.ok(lint.ignorePatterns.includes("node_modules"));
      assert.equal(lint.rules?.["unicorn/no-empty-file"], "off");

      const format = app.json<OxcFormatConfig>(".oxfmtrc.json");
      assert.equal(format.printWidth, 100);
      assert.deepEqual(format.sortImports, { newlinesBetween: false });
      assert.equal(format.sortPackageJson, false);

      const pkg = app.pkg();
      assert.equal(pkg.devDependencies?.oxlint, "^1.94.0");
      assert.equal(pkg.devDependencies?.oxfmt, "~0.79.0");
      assert.equal(pkg.scripts?.check, "oxlint && oxfmt --check");
      assert.equal(pkg.scripts?.["fmt:check"], "oxfmt --check");
    });
  }

  it("adds the vitest plugin when vitest is selected", async () => {
    const app = await scaffold("vite-react", ["oxc", "vitest"]);
    assert.ok(app.json<OxcLintConfig>(".oxlintrc.json").plugins.includes("vitest"));
  });

  it("sorts Tailwind classes when a Tailwind UI recipe is selected", async () => {
    const app = await scaffold("next", ["oxc", "shadcn-ui"]);
    assert.equal(app.json<OxcFormatConfig>(".oxfmtrc.json").sortTailwindcss, true);
  });

  it("rejects combining oxc with another linter", () => {
    assert.match(expectRejected("vite-react", ["oxc", "biome"]), /oxc[\s\S]*biome|biome[\s\S]*oxc/);
    assert.match(expectRejected("vite-react", ["oxc", "eslint"]), /oxc[\s\S]*eslint/);
  });
});
