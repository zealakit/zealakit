import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTemplate } from "@zealakit/core";
import { expectRejected, scaffold } from "../helpers/scaffold.js";

describe("gin-api template", () => {
  it("is registered as a Go server template", () => {
    const template = getTemplate("gin-api");
    assert.ok(template);
    assert.equal(template.ecosystem, "go");
    assert.equal(template.scope, "server");
    assert.equal(template.path, "go/gin-api");
    assert.equal(template.devCommand, "make run");
  });

  it("scaffolds a Gin API with go.mod and Gin dependency", async () => {
    const app = await scaffold("gin-api", []);
    assert.ok(app.exists("go.mod"));
    assert.ok(app.exists("go.sum"));
    assert.ok(app.exists("cmd/api/main.go"));
    assert.ok(app.exists("internal/bootstrap/app.go"));
    assert.ok(app.exists("internal/presentation/http/router/router.go"));
    assert.ok(app.exists("internal/presentation/http/handler/health.go"));
    assert.ok(app.exists("AGENTS.md"));
    assert.ok(app.exists(".agents/skills/gin-api/SKILL.md"));
    assert.ok(app.exists(".env.example"));
    assert.ok(!app.exists("package.json"));
    assert.ok(!app.exists("internal/domain"));
    assert.ok(!app.exists("internal/application"));

    for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
      assert.ok(!app.exists(leaked), `${leaked} must not leak`);
    }

    const goMod = app.read("go.mod");
    assert.match(goMod, new RegExp(`^module example\\.com/${path.basename(app.dir)}$`, "m"));
    assert.match(goMod, /github\.com\/gin-gonic\/gin/);
    assert.doesNotMatch(goMod, /gin-api/);

    if (app.exists(".agents")) {
      const cursor = path.join(app.dir, ".cursor");
      assert.ok(fs.lstatSync(cursor).isSymbolicLink());
      assert.equal(fs.readlinkSync(cursor), ".agents");
    }
  });

  it("rejects TypeScript recipes that lack a gin-api overlay", () => {
    expectRejected("gin-api", ["biome"]);
    expectRejected("gin-api", ["type-orm"]);
  });
});
