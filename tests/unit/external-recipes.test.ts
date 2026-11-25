import "../register.js";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  type FetchLike,
  getRecipe,
  loadRecipeDirectory,
  PACKAGE_ROOT,
  parseExternalSpec,
  parseRecipeData,
  readProjectManifest,
  resolveExternalRecipe,
  scaffoldProject,
  unsafeArchiveEntries,
  withDefaultRecipes,
} from "@zealakit/core/internal";

import { loadExternalSpecs } from "../../apps/cli/src/external.js";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-external-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));
let counter = 0;
const tmp = (label: string) => fs.mkdtempSync(path.join(workRoot, `${label}-${++counter}-`));

const BASE = {
  schemaVersion: 1,
  id: "ext-banner",
  name: "Banner",
  category: "utils",
  supportedScopes: ["client", "hybrid"],
};

function writeRecipe(
  dir: string,
  overrides: Record<string, unknown> = {},
  files: Record<string, string> = {},
) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "recipe.json"), JSON.stringify({ ...BASE, ...overrides }));
  for (const [relative, content] of Object.entries({
    "shared/src/banner.txt": "hello\n",
    ...files,
  })) {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), content);
  }
  return dir;
}

describe("recipe.json data form", () => {
  it("builds a RecipeConfig with a manifest and compiled transforms", () => {
    const parsed = parseRecipeData(
      {
        ...BASE,
        npm: { dependencies: { left: "^1.0.0" }, scripts: { banner: "echo hi" } },
        transforms: {
          "vite-react": [
            { file: "src/main.tsx", pattern: "App", flags: "g", replacement: "Shell" },
          ],
        },
      },
      { dir: "/x" },
    );
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.errors.join());
    assert.equal(parsed.recipe.manifest.ecosystem, "node");
    assert.deepEqual((parsed.recipe.manifest as { packages: object }).packages, { left: "^1.0.0" });
    assert.ok(parsed.recipe.fileTransforms?.["vite-react"]?.[0]?.pattern instanceof RegExp);
    assert.equal(parsed.recipe.finalize, undefined);
  });

  it("rejects code-like fields, bad categories, bad regexes and mismatched ecosystems", () => {
    for (const bad of [
      { ...BASE, finalize: "rm -rf /" },
      { ...BASE, category: "nope" },
      { ...BASE, id: "Bad Id" },
      { ...BASE, supportedScopes: [] },
      { ...BASE, transforms: { next: [{ file: "a", pattern: "(", replacement: "x" }] } },
      {
        ...BASE,
        transforms: { next: [{ file: "a", pattern: "x", flags: "y", replacement: "x" }] },
      },
      { ...BASE, transforms: { next: [{ file: "a" }] } },
      { ...BASE, ecosystem: "go", npm: { dependencies: {} } },
    ]) {
      assert.equal(parseRecipeData(bad, { dir: "/x" }).ok, false, JSON.stringify(bad));
    }
  });

  it("rejects recipe folders that contain symlinks", () => {
    const dir = writeRecipe(tmp("link"));
    fs.symlinkSync("/etc/passwd", path.join(dir, "shared", "evil"));
    const loaded = loadRecipeDirectory(dir);
    assert.equal(loaded.ok, false);
    assert.match(loaded.ok ? "" : loaded.errors.join(), /symbolic links/);
  });
});

describe("external sources", () => {
  it("parses path and github specs and rejects traversal", () => {
    assert.deepEqual(parseExternalSpec("./r", "/cwd"), {
      ok: true,
      source: { kind: "path", dir: "/cwd/r" },
    });
    const gh = parseExternalSpec("github:acme/recipes/auth/jwt#v1.2.0", "/cwd");
    assert.ok(gh.ok);
    assert.deepEqual(gh.source, {
      kind: "github",
      owner: "acme",
      repo: "recipes",
      subPath: "auth/jwt",
      ref: "v1.2.0",
    });
    for (const bad of ["github:acme", "github:acme/r/../x", "github:acme/r#a..b", "github:a b/r"]) {
      assert.equal(parseExternalSpec(bad, "/cwd").ok, false, bad);
    }
  });

  it("flags links and unsafe paths in archive listings", () => {
    assert.deepEqual(unsafeArchiveEntries("repo/a\nrepo/b\n", "-rw-r--r-- x\n"), []);
    assert.equal(unsafeArchiveEntries("/etc/x\n../y\nrepo/ok\n", "").length, 2);
    assert.equal(
      unsafeArchiveEntries("repo/l\n", "lrwxr-xr-x 1 u g 0 d repo/l -> /etc\n").length,
      1,
    );
  });

  function makeArchive(withSymlink: boolean): Buffer {
    const sha = "a".repeat(40);
    const root = tmp("repo");
    const top = path.join(root, `recipes-${sha}`);
    writeRecipe(path.join(top, "auth"), { id: "gh-auth" });
    if (withSymlink) fs.symlinkSync("/etc/passwd", path.join(top, "auth", "link"));
    const archive = path.join(root, "a.tar.gz");
    execFileSync("tar", ["-czf", archive, "-C", root, `recipes-${sha}`]);
    return fs.readFileSync(archive);
  }

  function fakeFetch(archive: Buffer, calls: string[]): FetchLike {
    return async (url) => {
      calls.push(url);
      if (url.startsWith("https://api.github.com/")) {
        return {
          ok: true,
          status: 200,
          text: async () => "a".repeat(40),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      const bytes = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer;
      return { ok: true, status: 200, text: async () => "", arrayBuffer: async () => bytes };
    };
  }

  it("downloads once, pins the commit SHA, and reuses the cache", async () => {
    const cacheDir = tmp("cache");
    const calls: string[] = [];
    const fetch = fakeFetch(makeArchive(false), calls);
    const first = await resolveExternalRecipe("github:acme/recipes/auth#main", {
      cwd: "/",
      cacheDir,
      fetch,
    });
    assert.ok(first.ok, first.ok ? "" : first.errors.join());
    assert.equal(first.recipe.id, "gh-auth");
    assert.equal(first.recipe.external?.sha, "a".repeat(40));
    assert.equal(first.recipe.external?.ref, "main");

    await resolveExternalRecipe("github:acme/recipes/auth#main", { cwd: "/", cacheDir, fetch });
    assert.equal(calls.filter((url) => url.includes("codeload")).length, 1);
  });

  it("refuses archives containing symlinks and bad API responses", async () => {
    const result = await resolveExternalRecipe("github:acme/recipes/auth", {
      cwd: "/",
      cacheDir: tmp("cache"),
      fetch: fakeFetch(makeArchive(true), []),
    });
    assert.equal(result.ok, false);

    const notFound: FetchLike = async () => ({
      ok: false,
      status: 404,
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    assert.equal(
      (
        await resolveExternalRecipe("github:acme/x", {
          cwd: "/",
          cacheDir: tmp("cache"),
          fetch: notFound,
        })
      ).ok,
      false,
    );
  });
});

describe("external recipes in projects", () => {
  it("applies shared files and package merges, hides recipe.json, and records provenance", async () => {
    const dir = writeRecipe(tmp("recipe"), {
      id: "ext-apply",
      npm: { dependencies: { "left-pad": "^1.3.0" }, scripts: { banner: "echo hi" } },
    });
    const loaded = await loadExternalSpecs([dir], "/");
    assert.deepEqual(loaded.errors, []);

    const project = await scaffoldProject(
      {
        projectName: "ext-app",
        templateId: "vite-react",
        recipeIds: withDefaultRecipes("client", ["ext-apply"]),
      },
      tmp("out"),
    );
    assert.equal(fs.readFileSync(path.join(project, "src/banner.txt"), "utf-8"), "hello\n");
    assert.equal(fs.existsSync(path.join(project, "recipe.json")), false);
    const pkg = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf-8"));
    assert.equal(pkg.dependencies["left-pad"], "^1.3.0");
    assert.equal(pkg.scripts.banner, "echo hi");
    const manifest = readProjectManifest(project);
    assert.ok(manifest?.ok);
    assert.deepEqual(manifest.manifest.externalRecipes, [{ id: "ext-apply", source: dir }]);
  });

  it("cannot replace a built-in recipe id", async () => {
    const dir = writeRecipe(tmp("recipe"), { id: "biome" });
    const loaded = await loadExternalSpecs([dir], "/");
    assert.match(loaded.errors.join(), /collides with a built-in/);
    assert.equal(getRecipe("biome")?.external, undefined);
  });

  it("applies data-driven transforms", async () => {
    const dir = writeRecipe(tmp("recipe"), {
      id: "ext-transform",
      transforms: {
        "vite-react": [
          {
            file: "src/main.tsx",
            pattern: "StrictMode",
            flags: "g",
            replacement: "StrictMode /* ext */",
          },
        ],
      },
    });
    assert.deepEqual((await loadExternalSpecs([dir], "/")).errors, []);
    const project = await scaffoldProject(
      {
        projectName: "ext-t",
        templateId: "vite-react",
        recipeIds: withDefaultRecipes("client", ["ext-transform"]),
      },
      tmp("out"),
    );
    assert.match(
      fs.readFileSync(path.join(project, "src/main.tsx"), "utf-8"),
      /StrictMode \/\* ext \*\//,
    );
  });
});

describe("zealakit create/add with external recipes (CLI)", () => {
  function run(args: string[], cwd: string) {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, CLI_ENTRY, ...args], {
      cwd,
      encoding: "utf-8",
      env: noColorEnv({ ZEALAKIT_CONFIG_DIR: path.join(workRoot, "cfg") }),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }

  it("needs --trust-external when not interactive, then works for create and add", () => {
    const cwd = tmp("cli");
    writeRecipe(path.join(cwd, "my-recipe"), { id: "cli-ext" });

    const refused = run(["create", "a", "-t", "vite-react", "-w", "./my-recipe", "-y"], cwd);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /--trust-external/);
    assert.equal(fs.existsSync(path.join(cwd, "a")), false);

    const ok = run(
      ["create", "a", "-t", "vite-react", "-w", "./my-recipe", "-y", "--trust-external"],
      cwd,
    );
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(fs.existsSync(path.join(cwd, "a/src/banner.txt")));

    // `add` re-resolves the project's recorded externals before planning.
    const added = run(["add", "zustand", "-y", "--force"], path.join(cwd, "a"));
    assert.equal(added.status, 0, added.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "a/zealakit.json"), "utf-8"));
    assert.equal(manifest.externalRecipes[0].id, "cli-ext");
  });

  it("recipe init + validate round-trips", () => {
    const cwd = tmp("init");
    assert.equal(run(["recipe", "init", "acme-thing"], cwd).status, 0);
    const validated = run(["recipe", "validate", "acme-thing", "--json"], cwd);
    assert.equal(validated.status, 0, validated.stderr);
    const out = JSON.parse(validated.stdout);
    assert.equal(out.ok, true);
    assert.ok(out.templates.length > 0);

    fs.writeFileSync(path.join(cwd, "acme-thing", "recipe.json"), "{}");
    assert.equal(run(["recipe", "validate", "acme-thing"], cwd).status, 3);
  });
});
