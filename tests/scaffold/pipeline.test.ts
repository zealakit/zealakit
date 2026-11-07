import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  buildScaffoldPlan,
  getAllTemplateIds,
  getManifestAdapter,
  getRecipe,
  getRecipeAgentEntry,
  getTemplate,
  type ManifestAdapter,
  type RecipeConfig,
  resolveRecipeDependencies,
  type ScaffoldConfig,
  ScaffoldValidationError,
  scaffoldProject,
  setManifestAdapter,
  type TemplateConfig,
  validateGeneratedOutput,
  withDefaultRecipes,
} from "@zealakit/core";
import { ScaffoldCommitError } from "../../packages/core/src/scaffold/commit.js";
import { listRecipeFiles, listTemplateFiles } from "../../packages/core/src/scaffold/inventory.js";
import { planPackageMerges } from "../../packages/ecosystem-node/src/manifest/package-plan.js";

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-pipeline-test-"));
const stageRoot = path.join(testRoot, "stages");
fs.mkdirSync(stageRoot);
const previousTmp = {
  TMPDIR: process.env.TMPDIR,
  TMP: process.env.TMP,
  TEMP: process.env.TEMP,
};
process.env.TMPDIR = stageRoot;
process.env.TMP = stageRoot;
process.env.TEMP = stageRoot;

after(() => {
  for (const key of ["TMPDIR", "TMP", "TEMP"] as const) {
    const value = previousTmp[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  fs.rmSync(testRoot, { recursive: true, force: true });
});

let counter = 0;

function caseDir(): string {
  const dir = path.join(testRoot, `case-${++counter}`);
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

function assertStagesCleaned(): void {
  assert.deepEqual(fs.readdirSync(stageRoot), [], "staging directories must be cleaned up");
}

function assertCommitSiblingsClean(parentDir: string): void {
  const leftovers = fs
    .readdirSync(parentDir)
    .filter((name) => name.includes(".zealakit-commit-") || name.includes(".zealakit-backup-"));
  assert.deepEqual(leftovers, []);
}

type ResolvedGeneration = {
  config: ScaffoldConfig;
  template: TemplateConfig;
};

function resolveGeneration(templateId: string, picked: string[]): ResolvedGeneration {
  const template = getTemplate(templateId);
  assert.ok(template, `unknown template ${templateId}`);
  const withDefaults = withDefaultRecipes(template.scope, picked);
  const resolved = resolveRecipeDependencies(withDefaults);
  assert.equal(resolved.ok, true, `recipe resolution failed for ${templateId}`);
  return {
    template,
    config: {
      projectName: `app-${templateId}`,
      templateId,
      recipeIds: resolved.recipeIds,
    },
  };
}

async function generate(templateId: string, picked: string[] = []) {
  const cwd = caseDir();
  const { config, template } = resolveGeneration(templateId, picked);
  const dir = await scaffoldProject(config, cwd);
  return { cwd, dir, config, template };
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

function assertAgentLayout(dir: string): void {
  const agentsDir = path.join(dir, ".agents");
  const cursorPath = path.join(dir, ".cursor");
  if (!fs.existsSync(agentsDir)) {
    assert.equal(fs.existsSync(cursorPath), false);
    return;
  }
  assert.equal(fs.lstatSync(cursorPath).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(cursorPath), ".agents");
  assert.equal(fs.statSync(cursorPath).isDirectory(), true);
}

function withPatched<T extends object, R>(target: T, patch: Partial<T>, run: () => R): R {
  const snapshot = { ...target };
  Object.assign(target, patch);
  try {
    return run();
  } finally {
    for (const key of Object.keys(target)) {
      if (!(key in snapshot)) {
        delete (target as Record<string, unknown>)[key];
      }
    }
    Object.assign(target, snapshot);
  }
}

function recipeFor(id: string): RecipeConfig {
  const recipe = getRecipe(id);
  assert.ok(recipe, `unknown recipe ${id}`);
  return recipe;
}

const TEMPLATE_IDS = getAllTemplateIds();
const testedTemplateIds = new Set<string>();

describe("end-to-end generation for every registered template", () => {
  for (const templateId of TEMPLATE_IDS) {
    it(`scaffolds ${templateId} through the real pipeline`, async () => {
      testedTemplateIds.add(templateId);
      const { cwd, dir, config, template } = await generate(templateId);

      const validation = validateGeneratedOutput(dir, config);
      assert.deepEqual(validation, { ok: true, errors: [] });

      // Every template file (with `_gitignore` mapped) must be present.
      for (const relativePath of listTemplateFiles(templateId).keys()) {
        assert.ok(
          fs.existsSync(path.join(dir, relativePath)),
          `${templateId}: missing template file ${relativePath}`,
        );
      }

      // Every file from the applied recipes (including default recipes) must be present.
      for (const recipeId of config.recipeIds) {
        for (const relativePath of listRecipeFiles(recipeId, templateId, template).keys()) {
          assert.ok(
            fs.existsSync(path.join(dir, relativePath)),
            `${recipeId}: missing recipe file ${relativePath}`,
          );
        }
      }

      if ((template.ecosystem ?? "node") === "go") {
        const goMod = readFile(dir, "go.mod");
        assert.match(goMod, /^module\s+\S+/m);
        assert.ok(goMod.includes(config.projectName));
        assert.equal(fs.existsSync(path.join(dir, "package.json")), false);
      } else {
        const pkg = JSON.parse(readFile(dir, "package.json")) as {
          name: string;
          scripts?: Record<string, string>;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        assert.equal(pkg.name, config.projectName);
      }

      assertAgentLayout(dir);
      assertStagesCleaned();
      assertCommitSiblingsClean(cwd);
      assert.deepEqual(fs.readdirSync(cwd), [config.projectName]);
    });
  }

  it("covers the entire registered template matrix", () => {
    assert.ok(TEMPLATE_IDS.length > 0);
    assert.deepEqual([...testedTemplateIds].sort(), [...TEMPLATE_IDS].sort());
    const ecosystems = new Set(TEMPLATE_IDS.map((id) => getTemplate(id)?.ecosystem ?? "node"));
    assert.deepEqual([...ecosystems].sort(), ["go", "node"]);
  });
});

describe("representative recipe combinations", () => {
  const COMBINATIONS: { templateId: string; recipes: string[] }[] = [
    {
      templateId: "vite-react",
      recipes: ["biome", "zustand", "hookform-zod", "shadcn-ui", "storybook"],
    },
    { templateId: "vite-vue", recipes: ["biome", "pinia", "vee-validate-zod", "shadcn-vue"] },
    { templateId: "next", recipes: ["biome", "shadcn-ui", "prisma", "storybook"] },
    { templateId: "nuxt", recipes: ["biome", "pinia", "vee-validate-zod", "kyjs", "nuxt-ui"] },
    { templateId: "nest", recipes: ["biome", "drizzle-orm"] },
    { templateId: "hono", recipes: ["biome", "type-orm"] },
    { templateId: "astro-react-hybrid", recipes: ["biome", "shadcn-ui", "drizzle-orm"] },
  ];

  for (const combination of COMBINATIONS) {
    it(`applies ${combination.recipes.join(", ")} on ${combination.templateId}`, async () => {
      const { cwd, dir, config, template } = await generate(
        combination.templateId,
        combination.recipes,
      );
      assert.deepEqual(validateGeneratedOutput(dir, config), { ok: true, errors: [] });

      const plan = planPackageMerges(config);
      assert.deepEqual(plan.conflicts, []);

      const pkg = JSON.parse(readFile(dir, "package.json")) as {
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      for (const [name, version] of Object.entries(plan.dependencies)) {
        assert.equal(pkg.dependencies[name], version, `dependency ${name}`);
      }
      for (const [name, version] of Object.entries(plan.devDependencies)) {
        assert.equal(pkg.devDependencies[name], version, `devDependency ${name}`);
      }
      for (const [name, command] of Object.entries(plan.scripts)) {
        assert.equal(pkg.scripts[name], command, `script ${name}`);
      }

      // Agent entries contributed by recipes are appended to the generated docs.
      for (const recipeId of config.recipeIds) {
        const entry = getRecipeAgentEntry(recipeId);
        if (!entry) continue;
        const agentsDoc = readFile(dir, "AGENTS.md");
        assert.ok(
          agentsDoc.includes(entry.split("\n")[0] ?? ""),
          `${recipeId}: AGENTS.md missing recipe entry`,
        );
      }

      // Finalize hook: Biome drops the nested `root` flag.
      if (config.recipeIds.includes("biome")) {
        const biomeConfig = JSON.parse(readFile(dir, "biome.json")) as Record<string, unknown>;
        assert.equal(biomeConfig.root, undefined);
      }

      // Default recipe transform: client-shared-pieces wires i18n on Vite React.
      if (template.scope === "client" && combination.templateId === "vite-react") {
        assert.match(readFile(dir, "src/main.tsx"), /\.\/configs\/i18n/);
      }

      assertAgentLayout(dir);
      assertStagesCleaned();
      assertCommitSiblingsClean(cwd);
    });
  }
});

describe("existing target directories and repeated generation", () => {
  it("commits into an existing empty target", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", []);
    fs.mkdirSync(path.join(cwd, config.projectName));
    await scaffoldProject(config, cwd);
    assert.ok(fs.existsSync(path.join(cwd, config.projectName, "package.json")));
    assertStagesCleaned();
  });

  it("replaces an existing non-empty target (documented overwrite behavior)", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["biome"]);
    writeFile(cwd, `${config.projectName}/stale.txt`, "old");
    await scaffoldProject(config, cwd);
    assert.equal(fs.existsSync(path.join(cwd, config.projectName, "stale.txt")), false);
    assert.ok(fs.existsSync(path.join(cwd, config.projectName, "package.json")));
  });

  it("regenerates the same configuration deterministically", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["biome", "zustand"]);
    const first = await scaffoldProject(config, cwd);
    const firstTree = snapshotTree(first);
    const firstManifest = readFile(first, "package.json");

    const second = await scaffoldProject(config, cwd);

    assert.equal(second, first);
    assert.deepEqual(snapshotTree(second), firstTree);
    assert.equal(readFile(second, "package.json"), firstManifest);
    assertStagesCleaned();
    assertCommitSiblingsClean(cwd);
    assert.deepEqual(fs.readdirSync(cwd), [config.projectName]);
  });

  it("rejects duplicate recipe ids without duplicating output", () => {
    const cwd = caseDir();
    const config: ScaffoldConfig = {
      projectName: "app-duplicates",
      templateId: "vite-react",
      recipeIds: ["biome", "biome"],
    };
    const plan = buildScaffoldPlan(config, cwd);
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.config.recipeIds, ["client-shared-pieces", "biome"]);
    assert.equal(fs.existsSync(path.join(cwd, "app-duplicates")), false);
  });
});

describe("full-pipeline validation failures", () => {
  it("rejects exclusive recipe combinations before writing", async () => {
    const cwd = caseDir();
    const config: ScaffoldConfig = {
      projectName: "app-exclusive",
      templateId: "vite-react",
      recipeIds: ["mui", "antd"],
    };
    await assert.rejects(
      () => scaffoldProject(config, cwd),
      (error: unknown) =>
        error instanceof ScaffoldValidationError && /exclusive/i.test(error.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, "app-exclusive")), false);
    assertStagesCleaned();
  });

  it("rejects incompatible recipes before writing", async () => {
    const cwd = caseDir();
    const config: ScaffoldConfig = {
      projectName: "app-incompatible",
      templateId: "next",
      recipeIds: ["pinia"],
    };
    await assert.rejects(
      () => scaffoldProject(config, cwd),
      (error: unknown) =>
        error instanceof ScaffoldValidationError &&
        /does not support|incompatible/i.test(error.message),
    );
    assert.equal(fs.existsSync(path.join(cwd, "app-incompatible")), false);
    assertStagesCleaned();
  });
});

describe("failure injection through the real pipeline", () => {
  it("keeps the existing target when template copy fails", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", []);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");

    const template = getTemplate("vite-react");
    assert.ok(template);
    await withPatched(template, { path: "node/__missing__" }, async () => {
      await assert.rejects(() => scaffoldProject(config, cwd), /Source directory does not exist/);
    });

    assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    assertStagesCleaned();
    assertCommitSiblingsClean(cwd);
  });

  it("keeps the target when recipe copy fails", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["zustand"]);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");

    await withPatched(recipeFor("zustand"), { path: "node/__missing__" }, async () => {
      await assert.rejects(() => scaffoldProject(config, cwd), /Recipe files do not exist/);
    });

    assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    assertStagesCleaned();
  });

  it("keeps the target when a file transform fails", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", []);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");

    await withPatched(
      recipeFor("client-shared-pieces"),
      {
        fileTransforms: {
          "vite-react": [
            {
              file: "src/main.tsx",
              pattern: /__pattern_that_never_matches__/,
              replacement: "unreachable",
            },
          ],
        },
      },
      async () => {
        await assert.rejects(() => scaffoldProject(config, cwd), /transform did not match/);
      },
    );

    assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    assertStagesCleaned();
  });

  it("keeps the target when a recipe finalize hook fails", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["biome"]);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");

    await withPatched(
      recipeFor("biome"),
      {
        finalize: () => {
          throw new Error("simulated finalize failure");
        },
      },
      async () => {
        await assert.rejects(() => scaffoldProject(config, cwd), /simulated finalize failure/);
      },
    );

    assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    assertStagesCleaned();
  });

  it("keeps the target when manifest merging fails", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["biome"]);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");
    const original = getManifestAdapter("node");
    const failing: ManifestAdapter = {
      ...original,
      applyMerges: () => {
        throw new Error("simulated manifest failure");
      },
    };

    setManifestAdapter("node", failing);
    try {
      await assert.rejects(() => scaffoldProject(config, cwd), /simulated manifest failure/);
    } finally {
      setManifestAdapter("node", original);
    }

    assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    assertStagesCleaned();
  });

  it("fails generated-output validation and leaves no partial target", async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", ["biome"]);

    await withPatched(
      recipeFor("biome"),
      {
        finalize: (targetDir: string) => {
          fs.rmSync(path.join(targetDir, ".agents"), { recursive: true, force: true });
        },
      },
      async () => {
        await assert.rejects(
          () => scaffoldProject(config, cwd),
          (error: unknown) => error instanceof ScaffoldValidationError,
        );
      },
    );

    assert.equal(fs.existsSync(path.join(cwd, config.projectName)), false);
    assertStagesCleaned();
  });

  it("keeps the existing target intact when commit fails", {
    skip:
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0),
  }, async () => {
    const cwd = caseDir();
    const { config } = resolveGeneration("vite-react", []);
    writeFile(cwd, `${config.projectName}/keep.txt`, "user data");
    fs.chmodSync(cwd, 0o500);
    try {
      await assert.rejects(
        () => scaffoldProject(config, cwd),
        (error: unknown) =>
          error instanceof ScaffoldCommitError &&
          /Failed to create a commit directory|EACCES|permission/i.test(error.message),
      );
      assert.equal(readFile(cwd, `${config.projectName}/keep.txt`), "user data");
    } finally {
      fs.chmodSync(cwd, 0o700);
    }
    assertStagesCleaned();
    assertCommitSiblingsClean(cwd);
  });
});
