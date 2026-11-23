import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { computeOutdated, scaffoldProject, withDefaultRecipes } from "@zealakit/core/internal";

import { parseGoRequires } from "../../packages/core/src/versions/outdated.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-outdated-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
async function project(templateId: string, scope: "client" | "server", recipes: string[]) {
  return scaffoldProject(
    { projectName: `o-${++counter}`, templateId, recipeIds: withDefaultRecipes(scope, recipes) },
    path.join(workRoot, `case-${counter}`),
  );
}

describe("computeOutdated", () => {
  it("is empty for a fresh project", async () => {
    const report = computeOutdated(await project("vite-react", "client", ["zustand"]));
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(report.entries, []);
    assert.equal(report.kitVersion.status, "same");
  });

  it("reports older ranges with their source, and newer ones as ahead", async () => {
    const dir = await project("vite-react", "client", ["zustand"]);
    const file = path.join(dir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf-8"));
    pkg.dependencies.zustand = "^4.0.0";
    pkg.dependencies.react = "^99.0.0";
    fs.writeFileSync(file, JSON.stringify(pkg));
    const report = computeOutdated(dir);
    const byName = Object.fromEntries(report.entries.map((entry) => [entry.package, entry]));
    assert.equal(byName.zustand?.status, "behind");
    assert.equal(byName.zustand?.source, "recipe:zustand");
    assert.equal(byName.react?.status, "ahead");
    assert.equal(byName.react?.source, "template:vite-react");
  });

  it("flags an older kit version", async () => {
    const dir = await project("vite-react", "client", []);
    const file = path.join(dir, "zealakit.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf-8"));
    manifest.kitVersion = "1.0.0-beta.1";
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.equal(computeOutdated(dir).kitVersion.status, "behind");
  });

  it("compares go.mod requirements", async () => {
    const dir = await project("stdlib-api", "server", ["postgres"]);
    const file = path.join(dir, "go.mod");
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf-8").replace(/(github\.com\/jackc\/pgx\/v5) v[\w.]+/, "$1 v5.0.0"),
    );
    const report = computeOutdated(dir);
    assert.deepEqual(
      report.entries.map((entry) => [entry.package, entry.status, entry.source]),
      [["github.com/jackc/pgx/v5", "behind", "recipe:postgres"]],
    );
  });

  it("blocks when zealakit.json is missing", () => {
    const report = computeOutdated(fs.mkdtempSync(path.join(workRoot, "plain-")));
    assert.match(report.blockers.join(), /No zealakit\.json/);
  });
});

describe("parseGoRequires", () => {
  it("reads single-line and block requires, ignoring comments", () => {
    assert.deepEqual(
      parseGoRequires(
        "module x\n\nrequire a.com/b v1.2.3\n\nrequire (\n\tc.com/d v0.1.0 // indirect\n)\n",
      ),
      { "a.com/b": "v1.2.3", "c.com/d": "v0.1.0" },
    );
  });
});
