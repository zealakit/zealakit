import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  applyAgentEntry,
  applyFileTransforms,
  assertStagingRealPath,
  assertStagingSymlinksSafe,
  buildScaffoldPlan,
  ensureCursorAgentsSymlink,
  getRecipe,
  getRecipeAgentEntry,
  isPathInsideRoot,
  type RecipeConfig,
  resolveStagingPath,
  type ScaffoldConfig,
} from "@zealakit/core";
import { goManifestAdapter } from "@zealakit/ecosystem-go";
import { mergePackageJson } from "../../packages/ecosystem-node/src/manifest/package-json.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-staging-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function tempDir(prefix = "case"): string {
  const dir = path.join(workRoot, `${prefix}-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relativePath: string, content: string): void {
  const target = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function readFile(dir: string, relativePath: string): string {
  return fs.readFileSync(path.join(dir, relativePath), "utf-8");
}

function recipeWith(transforms: NonNullable<RecipeConfig["fileTransforms"]>): RecipeConfig {
  return {
    id: "test-recipe",
    name: "Test recipe",
    category: "utils",
    supportedScopes: "all",
    packages: {},
    devDependencies: {},
    scripts: {},
    fileTransforms: transforms,
  };
}

function snapshotTree(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const visit = (dir: string, relativeDir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        entries[relativePath] = `link:${fs.readlinkSync(fullPath)}`;
        continue;
      }
      if (entry.isDirectory()) {
        entries[`${relativePath}/`] = "dir";
        visit(fullPath, relativePath);
        continue;
      }
      entries[relativePath] = fs.readFileSync(fullPath, "utf-8");
    }
  };
  visit(root, "");
  return entries;
}

describe("staging path boundary", () => {
  it("accepts relative, nested, normalized, and in-root absolute paths", () => {
    const stage = tempDir("stage");
    assert.equal(resolveStagingPath(stage, "src/main.ts"), path.join(stage, "src", "main.ts"));
    assert.equal(
      resolveStagingPath(stage, "src/../package.json"),
      path.join(stage, "package.json"),
    );
    assert.equal(
      resolveStagingPath(stage, path.join(stage, "nested", "file.ts")),
      path.join(stage, "nested", "file.ts"),
    );
    assert.equal(isPathInsideRoot(stage, stage), true);
    assert.equal(isPathInsideRoot(stage, path.join(stage, "a", "b")), true);
  });

  it("rejects traversal and absolute paths outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    assert.throws(() => resolveStagingPath(stage, "../outside"), /outside the staging/);
    assert.throws(
      () => resolveStagingPath(stage, path.join("nested", "..", "..", "escape.txt")),
      /outside the staging/,
    );
    assert.throws(
      () => resolveStagingPath(stage, path.join(outside, "file.txt")),
      /outside the staging/,
    );
    assert.equal(isPathInsideRoot(stage, outside), false);
  });
});

describe("staging symlink safety", () => {
  it("rejects staged symlinks that point outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    fs.symlinkSync(outside, path.join(stage, "escape"), "dir");
    assert.throws(() => assertStagingSymlinksSafe(stage), /points outside/);
  });

  it("allows staged symlinks that stay inside staging", () => {
    const stage = tempDir("stage");
    fs.mkdirSync(path.join(stage, ".agents"));
    fs.symlinkSync(".agents", path.join(stage, ".cursor"));
    assert.doesNotThrow(() => assertStagingSymlinksSafe(stage));
  });

  it("rejects existing files reached through a symlinked parent", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "secret.txt", "outside");
    fs.symlinkSync(outside, path.join(stage, "link"), "dir");
    assert.throws(
      () => assertStagingRealPath(stage, path.join(stage, "link", "secret.txt")),
      /escapes the staging directory/,
    );
  });
});

describe("fileTransforms staging isolation", () => {
  it("applies transforms to nested files inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "src/app/main.ts", 'import App from "./app";');
    const recipe = recipeWith({
      tpl: [
        {
          file: "src/app/main.ts",
          pattern: /import App from "\.\/app";/,
          replacement: 'import App from "./app";\nimport "./configs/i18n";',
        },
      ],
    });

    applyFileTransforms(recipe, "tpl", stage);
    assert.match(readFile(stage, "src/app/main.ts"), /configs\/i18n/);
  });

  it("accepts .. segments that still resolve inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "config.ts", "value = 1;");
    const recipe = recipeWith({
      tpl: [{ file: "src/../config.ts", pattern: /value = 1;/, replacement: "value = 2;" }],
    });

    applyFileTransforms(recipe, "tpl", stage);
    assert.equal(readFile(stage, "config.ts"), "value = 2;");
  });

  it("rejects transforms that escape staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "target.txt", "external");
    const recipe = recipeWith({
      tpl: [{ file: "../outside/target.txt", pattern: /external/, replacement: "hacked" }],
    });

    assert.throws(() => applyFileTransforms(recipe, "tpl", stage), /outside the staging/);
    assert.equal(readFile(outside, "target.txt"), "external");
  });

  it("rejects transforms that reach outside through a symlinked parent", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "target.txt", "external");
    fs.symlinkSync(outside, path.join(stage, "link"), "dir");
    const recipe = recipeWith({
      tpl: [{ file: "link/target.txt", pattern: /external/, replacement: "hacked" }],
    });

    assert.throws(() => applyFileTransforms(recipe, "tpl", stage), /escapes the staging/);
    assert.equal(readFile(outside, "target.txt"), "external");
  });

  it("keeps the missing-target error behavior", () => {
    const stage = tempDir("stage");
    const recipe = recipeWith({
      tpl: [{ file: "missing.txt", pattern: /x/, replacement: "y" }],
    });
    assert.throws(
      () => applyFileTransforms(recipe, "tpl", stage),
      /transform target not found: missing\.txt/,
    );
  });
});

describe("manifest staging isolation", () => {
  const config: ScaffoldConfig = {
    projectName: "app",
    templateId: "vite-react",
    recipeIds: ["biome"],
  };

  it("merges package.json inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "package.json", '{"name":"old","scripts":{"dev":"vite"}}');
    mergePackageJson(stage, config);
    const merged = JSON.parse(readFile(stage, "package.json")) as {
      name: string;
      devDependencies: Record<string, string>;
    };
    assert.equal(merged.name, "app");
    assert.ok(merged.devDependencies["@biomejs/biome"]);
  });

  it("does not write through a package.json symlinked outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "package.json", '{"name":"outside"}');
    fs.symlinkSync(path.join(outside, "package.json"), path.join(stage, "package.json"));

    assert.throws(() => mergePackageJson(stage, config), /escapes the staging/);
    assert.equal(readFile(outside, "package.json"), '{"name":"outside"}');
  });

  it("rewrites go.mod inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "go.mod", "module example.com/old\n\ngo 1.22\n");
    writeFile(stage, "main.go", 'package main\n\nimport _ "example.com/old/internal"\n');

    goManifestAdapter.applyMerges(stage, {
      projectName: "smoke-app",
      templateId: "stdlib-api",
      recipeIds: [],
    });

    assert.match(readFile(stage, "go.mod"), /module example\.com\/smoke-app/);
    assert.match(readFile(stage, "main.go"), /example\.com\/smoke-app\/internal/);
  });

  it("does not write through a go.mod symlinked outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "go.mod", "module example.com/outside\n\ngo 1.22\n");
    fs.symlinkSync(path.join(outside, "go.mod"), path.join(stage, "go.mod"));

    assert.throws(
      () =>
        goManifestAdapter.applyMerges(stage, {
          projectName: "smoke-app",
          templateId: "stdlib-api",
          recipeIds: [],
        }),
      /escapes the staging/,
    );
    assert.equal(readFile(outside, "go.mod"), "module example.com/outside\n\ngo 1.22\n");
  });
});

describe("agent docs and .cursor symlink", () => {
  it("writes recipe agent entries inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "AGENTS.md", "# App\n\n## Always follow\n\n");
    writeFile(stage, "CLAUDE.md", "# App\n");
    applyAgentEntry("shadcn-ui", stage);
    const entry = getRecipeAgentEntry("shadcn-ui");
    assert.ok(entry);
    assert.ok(readFile(stage, "AGENTS.md").includes(entry.split("\n")[0] ?? ""));
    assert.ok(readFile(stage, "CLAUDE.md").includes(entry.split("\n")[0] ?? ""));
  });

  it("refuses to write an agent doc through an external symlink", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "AGENTS.md", "# External\n");
    fs.symlinkSync(path.join(outside, "AGENTS.md"), path.join(stage, "AGENTS.md"));

    assert.throws(() => applyAgentEntry("shadcn-ui", stage), /escapes the staging/);
    assert.equal(readFile(outside, "AGENTS.md"), "# External\n");
  });

  it("creates .cursor as a relative link inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, ".agents/rules.md", "rules");
    ensureCursorAgentsSymlink(stage);
    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
    assert.equal(readFile(stage, ".cursor/rules.md"), "rules");
  });

  it("replaces an external .cursor symlink without touching its target", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(stage, ".agents/rules.md", "rules");
    writeFile(outside, "keep.txt", "keep");
    fs.symlinkSync(outside, path.join(stage, ".cursor"), "dir");

    ensureCursorAgentsSymlink(stage);

    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
    assert.equal(readFile(outside, "keep.txt"), "keep");
  });

  it("rejects a .agents directory that resolves outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    fs.symlinkSync(outside, path.join(stage, ".agents"), "dir");

    assert.throws(() => ensureCursorAgentsSymlink(stage), /escapes the staging/);
    assert.equal(fs.existsSync(path.join(stage, ".cursor")), false);
  });
});

describe("recipe finalize staging isolation", () => {
  it("finalizes biome.json inside staging", () => {
    const stage = tempDir("stage");
    writeFile(stage, "biome.json", '{"root":false,"formatter":{"indentWidth":2}}');
    const finalize = getRecipe("biome")?.finalize;
    assert.ok(finalize);
    finalize(stage);
    const config = JSON.parse(readFile(stage, "biome.json")) as Record<string, unknown>;
    assert.equal(config.root, undefined);
    assert.deepEqual(config.formatter, { indentWidth: 2 });
  });

  it("does not write through a biome.json symlinked outside staging", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(outside, "biome.json", '{"root":false}');
    fs.symlinkSync(path.join(outside, "biome.json"), path.join(stage, "biome.json"));
    const finalize = getRecipe("biome")?.finalize;
    assert.ok(finalize);

    assert.throws(() => finalize(stage), /escapes the staging/);
    assert.equal(readFile(outside, "biome.json"), '{"root":false}');
  });
});

describe("buildScaffoldPlan stays read-only", () => {
  it("does not create or modify target files", () => {
    const cwd = tempDir("plan");
    writeFile(cwd, "app/keep.txt", "user data");
    const before = snapshotTree(cwd);

    const plan = buildScaffoldPlan(
      { projectName: "app", templateId: "vite-react", recipeIds: [] },
      cwd,
    );

    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(snapshotTree(cwd), before);
    assert.equal(fs.existsSync(path.join(cwd, "app", "package.json")), false);
  });

  it("does not create a new target directory", () => {
    const cwd = tempDir("plan");
    buildScaffoldPlan({ projectName: "new-app", templateId: "vite-react", recipeIds: [] }, cwd);
    assert.equal(fs.existsSync(path.join(cwd, "new-app")), false);
  });
});
