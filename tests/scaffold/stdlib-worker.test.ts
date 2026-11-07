import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTemplate } from "@zealakit/core";
import { expectRejected, scaffold } from "../helpers/scaffold.js";

describe("stdlib-worker template", () => {
  it("is registered as a Go infrastructure worker template", () => {
    const template = getTemplate("stdlib-worker");
    assert.ok(template);
    assert.equal(template.ecosystem, "go");
    assert.equal(template.scope, "infrastructure");
    assert.equal(template.path, "go/stdlib-worker");
    assert.equal(template.devCommand, "make run");
  });

  it("scaffolds a stdlib Go worker without package.json", async () => {
    const app = await scaffold("stdlib-worker", []);
    assert.ok(app.exists("go.mod"));
    assert.ok(app.exists("cmd/worker/main.go"));
    assert.ok(app.exists("internal/bootstrap/app.go"));
    assert.ok(app.exists("internal/application/worker/runner.go"));
    assert.ok(app.exists("internal/application/worker/processor.go"));
    assert.ok(app.exists("internal/worker/lifecycle.go"));
    assert.ok(app.exists("internal/infrastructure/config/config.go"));
    assert.ok(app.exists("AGENTS.md"));
    assert.ok(app.exists(".agents/skills/go-worker/SKILL.md"));
    assert.ok(!app.exists("package.json"));
    assert.ok(!app.exists("internal/domain"));

    for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
      assert.ok(!app.exists(leaked), `${leaked} must not leak`);
    }

    const goMod = app.read("go.mod");
    assert.match(goMod, new RegExp(`^module example\\.com/${path.basename(app.dir)}$`, "m"));
    assert.doesNotMatch(goMod, /stdlib-worker/);

    if (app.exists(".agents")) {
      const cursor = path.join(app.dir, ".cursor");
      assert.ok(fs.lstatSync(cursor).isSymbolicLink());
      assert.equal(fs.readlinkSync(cursor), ".agents");
    }
  });

  it("rejects TypeScript recipes that lack a stdlib-worker overlay", () => {
    expectRejected("stdlib-worker", ["biome"]);
    expectRejected("stdlib-worker", ["type-orm"]);
  });
});
