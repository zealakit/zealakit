import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  applyAddPlan,
  PACKAGE_ROOT,
  planAddRecipes,
  scaffoldProject,
  unifiedDiff,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-add-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
async function project(templateId: string, recipes: string[] = []): Promise<string> {
  return scaffoldProject(
    {
      projectName: `proj-${++counter}`,
      templateId,
      recipeIds: withDefaultRecipes(templateId === "vite-react" ? "client" : "server", recipes),
    },
    path.join(workRoot, `case-${counter}`),
  );
}

describe("unifiedDiff", () => {
  it("returns an empty string for equal input and a hunk otherwise", () => {
    assert.equal(unifiedDiff("a\nb\n", "a\nb\n", "f"), "");
    const diff = unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "f");
    assert.match(diff, /^--- a\/f\n\+\+\+ b\/f\n@@ -1,3 \+1,3 @@\n a\n-b\n\+B\n c\n$/);
  });
});

describe("planAddRecipes", () => {
  it("blocks when zealakit.json is missing", async () => {
    const dir = fs.mkdtempSync(path.join(workRoot, "empty-"));
    const plan = planAddRecipes(dir, ["biome"]);
    assert.match(plan.blockers.join("\n"), /No zealakit\.json/);
  });

  it("reports already-applied recipes and plans nothing", async () => {
    const dir = await project("vite-react", ["biome"]);
    const plan = planAddRecipes(dir, ["biome"]);
    assert.deepEqual(plan.alreadyApplied, ["biome"]);
    assert.deepEqual(plan.added, []);
    assert.deepEqual(plan.changes, []);
  });

  it("blocks conflicting and incompatible recipes with the usual messages", async () => {
    const dir = await project("vite-react", ["biome"]);
    assert.ok(planAddRecipes(dir, ["eslint"]).blockers.length > 0);
    assert.ok(planAddRecipes(dir, ["pinia"]).blockers.length > 0);
  });

  it("updates zealakit.json and merges package.json without touching user dependencies", async () => {
    const dir = await project("vite-react");
    const pkgFile = path.join(dir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
    pkg.dependencies.lodash = "^4.0.0";
    fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

    const plan = planAddRecipes(dir, ["zustand"]);
    assert.deepEqual(plan.packageChanges.dependencies, ["zustand"]);
    applyAddPlan(plan);

    const merged = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
    assert.equal(merged.dependencies.lodash, "^4.0.0");
    assert.ok(merged.dependencies.zustand);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "zealakit.json"), "utf-8"));
    assert.ok(manifest.recipes.includes("zustand"));
    assert.ok(manifest.requestedRecipes.includes("zustand"));
  });

  it("keeps files the user edited, shows the kit's patch, and can overwrite with a backup", async () => {
    const dir = await project("vite-react");
    const main = path.join(dir, "src/main.tsx");
    const edited = `${fs.readFileSync(main, "utf-8")}\nexport const mine = true;\n`;
    fs.writeFileSync(main, edited);

    const plan = planAddRecipes(dir, ["mui"]);
    const conflict = plan.changes.find((change) => change.path === "src/main.tsx");
    assert.equal(conflict?.kind, "conflict");
    assert.match(conflict?.diff ?? "", /MuiThemeProvider/);

    const kept = applyAddPlan(plan);
    assert.deepEqual(kept.skippedConflicts, ["src/main.tsx"]);
    assert.equal(fs.readFileSync(main, "utf-8"), edited);
    // The new files were still created.
    assert.ok(kept.created.length > 0);

    const dir2 = await project("vite-react");
    const main2 = path.join(dir2, "src/main.tsx");
    fs.writeFileSync(main2, `${fs.readFileSync(main2, "utf-8")}\nexport const mine = true;\n`);
    const replaced = applyAddPlan(planAddRecipes(dir2, ["mui"]), { overwriteFiles: true });
    assert.deepEqual(replaced.overwritten, ["src/main.tsx"]);
    assert.match(fs.readFileSync(main2, "utf-8"), /MuiThemeProvider/);
    assert.equal(fs.existsSync(path.join(dir2, ".zealakit")), false);
  });

  it("inserts agent entries into AGENTS.md even after the user edited it", async () => {
    const dir = await project("vite-react");
    const agents = path.join(dir, "AGENTS.md");
    fs.writeFileSync(agents, `${fs.readFileSync(agents, "utf-8")}\n## My notes\nkeep me\n`);
    applyAddPlan(planAddRecipes(dir, ["storybook"]));
    const text = fs.readFileSync(agents, "utf-8");
    assert.match(text, /Storybook/);
    assert.match(text, /keep me/);
  });
});

describe("zealakit add (CLI)", () => {
  function run(args: string[], cwd: string) {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, CLI_ENTRY, ...args], {
      cwd,
      encoding: "utf-8",
      env: noColorEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }

  it("--dry-run --json previews without writing", async () => {
    const dir = await project("vite-react");
    const result = run(["add", "zustand", "--dry-run", "--json"], dir);
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.deepEqual(out.added, ["zustand"]);
    assert.equal(fs.existsSync(path.join(dir, "src/stores")), false);
  });

  it("needs -y when not interactive and rejects unknown recipes", async () => {
    const dir = await project("vite-react");
    assert.equal(run(["add", "zustand"], dir).status, 2);
    assert.equal(run(["add", "nope", "-y"], dir).status, 3);
  });

  it("refuses a dirty git tree unless --force", async () => {
    const dir = await project("vite-react");
    const git = (...args: string[]) =>
      spawnSync("git", args, {
        cwd: dir,
        encoding: "utf-8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "t",
          GIT_AUTHOR_EMAIL: "t@t",
          GIT_COMMITTER_NAME: "t",
          GIT_COMMITTER_EMAIL: "t@t",
        },
      });
    if (git("init", "-q").status !== 0) return; // git unavailable
    git("add", "-A");
    git("commit", "-qm", "init");
    fs.writeFileSync(path.join(dir, "scratch.txt"), "dirty");

    const refused = run(["add", "zustand", "-y"], dir);
    assert.equal(refused.status, 3);
    assert.match(refused.stderr, /uncommitted changes/);
    assert.equal(run(["add", "zustand", "-y", "--force"], dir).status, 0);
    assert.ok(fs.existsSync(path.join(dir, "src/stores/something.store.ts")));
  });
});
