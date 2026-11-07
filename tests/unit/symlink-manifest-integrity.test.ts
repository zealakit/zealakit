import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  ensureCursorAgentsSymlink,
  getRecipe,
  type ScaffoldConfig,
  scaffoldProject,
  validateGeneratedOutput,
} from "@zealakit/core";
import { mergePackageJson } from "../../packages/ecosystem-node/src/manifest/package-json.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-integrity-test-"));
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

function baseManifest(): Record<string, unknown> {
  return {
    name: "template-name",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "tsc && vite build" },
    dependencies: { react: "^19.0.0" },
    devDependencies: { typescript: "^5.0.0" },
    peerDependencies: { "some-peer": "^1.0.0" },
    optionalDependencies: { fsevents: "^2.0.0" },
    engines: { node: ">=18" },
    packageManager: "pnpm@9.0.0",
    workspaces: ["packages/*"],
    customField: { nested: true },
  };
}

function stageWithManifest(manifest: Record<string, unknown> = baseManifest()): string {
  const stage = tempDir("stage");
  writeFile(stage, "package.json", `${JSON.stringify(manifest, null, 2)}\n`);
  return stage;
}

function parseManifest(dir: string): Record<string, unknown> {
  return JSON.parse(readFile(dir, "package.json")) as Record<string, unknown>;
}

async function scaffoldApp(
  templateId: string,
  recipeIds: string[] = [],
): Promise<{ dir: string; config: ScaffoldConfig }> {
  const cwd = tempDir("scaffold");
  const config: ScaffoldConfig = { projectName: "app", templateId, recipeIds };
  const dir = await scaffoldProject(config, cwd);
  return { dir, config };
}

describe(".cursor symlink integrity", () => {
  it("creates a relative directory symlink and is idempotent", () => {
    const stage = tempDir("stage");
    writeFile(stage, ".agents/rules.md", "rules");

    ensureCursorAgentsSymlink(stage);

    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
    assert.equal(fs.statSync(path.join(stage, ".cursor")).isDirectory(), true);
    assert.equal(readFile(stage, ".cursor/rules.md"), "rules");

    ensureCursorAgentsSymlink(stage);
    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
  });

  it("replaces a wrong symlink without touching its target", () => {
    const stage = tempDir("stage");
    const outside = tempDir("outside");
    writeFile(stage, ".agents/rules.md", "rules");
    writeFile(outside, "keep.txt", "keep");
    fs.symlinkSync(outside, path.join(stage, ".cursor"), "dir");

    ensureCursorAgentsSymlink(stage);

    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
    assert.equal(readFile(outside, "keep.txt"), "keep");
  });

  it("replaces an ordinary .cursor directory", () => {
    const stage = tempDir("stage");
    writeFile(stage, ".agents/rules.md", "rules");
    writeFile(stage, ".cursor/old-rule.mdc", "old");

    ensureCursorAgentsSymlink(stage);

    assert.equal(fs.lstatSync(path.join(stage, ".cursor")).isSymbolicLink(), true);
    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
  });

  it("replaces an ordinary .cursor file", () => {
    const stage = tempDir("stage");
    writeFile(stage, ".agents/rules.md", "rules");
    writeFile(stage, ".cursor", "not a link");

    ensureCursorAgentsSymlink(stage);

    assert.equal(fs.lstatSync(path.join(stage, ".cursor")).isSymbolicLink(), true);
    assert.equal(fs.readlinkSync(path.join(stage, ".cursor")), ".agents");
  });

  it("does nothing when .agents is missing", () => {
    const stage = tempDir("stage");
    ensureCursorAgentsSymlink(stage);
    assert.equal(fs.existsSync(path.join(stage, ".cursor")), false);
  });

  it("rejects a .agents path that is a file", () => {
    const stage = tempDir("stage");
    writeFile(stage, ".agents", "not a directory");
    assert.throws(() => ensureCursorAgentsSymlink(stage), /must be a directory/);
  });
});

describe("generated output agent validation", () => {
  it("accepts a valid Node.js output", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    assert.deepEqual(validateGeneratedOutput(dir, config), { ok: true, errors: [] });
  });

  it("accepts a valid output with multiple recipes", async () => {
    const { dir, config } = await scaffoldApp("vite-react", ["biome", "zustand"]);
    assert.deepEqual(validateGeneratedOutput(dir, config), { ok: true, errors: [] });
  });

  it("accepts a valid Go output", async () => {
    const { dir, config } = await scaffoldApp("stdlib-api");
    assert.deepEqual(validateGeneratedOutput(dir, config), { ok: true, errors: [] });
  });

  it("rejects a .cursor that points somewhere else", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    fs.rmSync(path.join(dir, ".cursor"));
    fs.symlinkSync(".agents-old", path.join(dir, ".cursor"), "dir");

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /must point to '\.agents'/.test(error)));
  });

  it("rejects an ordinary .cursor directory", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    fs.rmSync(path.join(dir, ".cursor"));
    fs.mkdirSync(path.join(dir, ".cursor"));

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /found a file or directory/.test(error)));
  });

  it("rejects a missing .cursor", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    fs.rmSync(path.join(dir, ".cursor"));

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /must be a symlink to '\.agents'/.test(error)));
  });

  it("rejects .cursor without .agents", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    fs.rmSync(path.join(dir, ".agents"), { recursive: true, force: true });

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /no '\.agents' directory/.test(error)));
  });

  it("rejects symlinks that escape the generated project", async () => {
    const { dir, config } = await scaffoldApp("vite-react");
    const outside = tempDir("outside");
    fs.symlinkSync(outside, path.join(dir, "escape"), "dir");

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /points outside/.test(error)));
  });
});

describe("manifest merge integrity", () => {
  const config: ScaffoldConfig = {
    projectName: "app",
    templateId: "vite-react",
    recipeIds: ["biome", "zustand"],
  };

  it("preserves unrelated metadata and existing entries", () => {
    const stage = stageWithManifest();
    mergePackageJson(stage, config);
    const pkg = parseManifest(stage);
    const base = baseManifest();

    assert.equal(pkg.name, "app");
    for (const field of [
      "version",
      "private",
      "type",
      "peerDependencies",
      "optionalDependencies",
      "engines",
      "packageManager",
      "workspaces",
      "customField",
    ]) {
      assert.deepEqual(pkg[field], base[field], field);
    }

    const dependencies = pkg.dependencies as Record<string, string>;
    const devDependencies = pkg.devDependencies as Record<string, string>;
    const scripts = pkg.scripts as Record<string, string>;
    assert.equal(dependencies.react, "^19.0.0");
    assert.equal(devDependencies.typescript, "^5.0.0");
    assert.equal(scripts.dev, "vite");
    assert.equal(scripts.build, "tsc && vite build");
  });

  it("adds recipe dependencies, devDependencies and scripts", () => {
    const stage = stageWithManifest();
    mergePackageJson(stage, config);
    const pkg = parseManifest(stage);
    const biome = getRecipe("biome");
    const zustand = getRecipe("zustand");
    assert.ok(biome && zustand);

    const devDependencies = pkg.devDependencies as Record<string, string>;
    for (const [name, version] of Object.entries(biome.devDependencies)) {
      assert.equal(devDependencies[name], version, name);
    }
    const dependencies = pkg.dependencies as Record<string, string>;
    for (const [name, version] of Object.entries(zustand.packages)) {
      assert.equal(dependencies[name], version, name);
    }
    const scripts = pkg.scripts as Record<string, string>;
    for (const [name, command] of Object.entries(biome.scripts)) {
      assert.equal(scripts[name], command, name);
    }
  });

  it("lets recipe contributions override template values deterministically", () => {
    const manifest = baseManifest();
    manifest.dependencies = { zustand: "^0.0.1", react: "^19.0.0" };
    manifest.scripts = { check: "old-check", dev: "vite" };
    const stage = stageWithManifest(manifest);
    const zustand = getRecipe("zustand");
    const biome = getRecipe("biome");
    assert.ok(zustand && biome);

    mergePackageJson(stage, config);

    const pkg = parseManifest(stage);
    const dependencies = pkg.dependencies as Record<string, string>;
    const scripts = pkg.scripts as Record<string, string>;
    for (const [name, version] of Object.entries(zustand.packages)) {
      assert.equal(dependencies[name], version, name);
    }
    assert.equal(scripts.check, biome.scripts.check);
  });

  it("fails deterministically on conflicting recipe contributions", () => {
    const stage = stageWithManifest();
    const before = readFile(stage, "package.json");
    assert.throws(
      () =>
        mergePackageJson(stage, {
          projectName: "app",
          templateId: "vite-react",
          recipeIds: ["hookform-zod", "vee-validate-zod"],
        }),
      /Conflicting manifest contributions:\n.*zod/,
    );
    assert.equal(readFile(stage, "package.json"), before);
  });

  it("reports invalid JSON without modifying the manifest", () => {
    const stage = tempDir("stage");
    writeFile(stage, "package.json", "{");
    assert.throws(() => mergePackageJson(stage, config), /Invalid package\.json/);
    assert.equal(readFile(stage, "package.json"), "{");
  });

  it("rejects a manifest that is not a JSON object", () => {
    const stage = tempDir("stage");
    writeFile(stage, "package.json", "[]");
    assert.throws(() => mergePackageJson(stage, config), /expected a JSON object/);
  });

  it("rejects invalid dependency shapes", () => {
    const arrayStage = stageWithManifest({ ...baseManifest(), dependencies: [] });
    assert.throws(() => mergePackageJson(arrayStage, config), /'dependencies' must be an object/);

    const valueStage = stageWithManifest({
      ...baseManifest(),
      dependencies: { react: 1 },
    });
    assert.throws(
      () => mergePackageJson(valueStage, config),
      /'dependencies\.react' must be a string/,
    );
  });

  it("is deterministic across repeated merges", () => {
    const stage = stageWithManifest();
    mergePackageJson(stage, config);
    const once = readFile(stage, "package.json");
    mergePackageJson(stage, config);
    const twice = readFile(stage, "package.json");
    assert.equal(twice, once);

    const parsed = JSON.parse(twice) as Record<string, unknown>;
    assert.equal(twice, `${JSON.stringify(parsed, null, 2)}\n`);
  });
});

describe("manifest output validation", () => {
  it("rejects corrupted JSON", async () => {
    const { dir, config } = await scaffoldApp("vite-react", ["biome"]);
    writeFile(dir, "package.json", "{");
    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /not valid JSON/.test(error)));
  });

  it("rejects invalid dependency field shapes", async () => {
    const { dir, config } = await scaffoldApp("vite-react", ["biome"]);
    const pkg = parseManifest(dir);
    pkg.dependencies = [];
    writeFile(dir, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);

    const result = validateGeneratedOutput(dir, config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /'dependencies' must be an object/.test(error)));
  });

  it("rejects missing recipe contributions and missing package.json", async () => {
    const { dir, config } = await scaffoldApp("vite-react", ["biome"]);
    const pkg = parseManifest(dir);
    const devDependencies = pkg.devDependencies as Record<string, string>;
    delete devDependencies["@biomejs/biome"];
    writeFile(dir, "package.json", `${JSON.stringify(pkg, null, 2)}\n`);

    const missingRecipe = validateGeneratedOutput(dir, config);
    assert.equal(missingRecipe.ok, false);
    assert.ok(missingRecipe.errors.some((error) => /Missing devDependency/.test(error)));

    fs.rmSync(path.join(dir, "package.json"));
    const missingManifest = validateGeneratedOutput(dir, config);
    assert.equal(missingManifest.ok, false);
    assert.ok(missingManifest.errors.some((error) => /package\.json is missing/.test(error)));
  });
});
