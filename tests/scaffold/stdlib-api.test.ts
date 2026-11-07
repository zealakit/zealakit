import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTemplate } from "@zealakit/core";
import { expectRejected, scaffold } from "../helpers/scaffold.js";

describe("stdlib-api template", () => {
  it("is registered as a Go server template", () => {
    const template = getTemplate("stdlib-api");
    assert.ok(template);
    assert.equal(template.ecosystem, "go");
    assert.equal(template.scope, "server");
    assert.equal(template.path, "go/stdlib-api");
    assert.equal(template.devCommand, "make run");
  });

  it("scaffolds a stdlib Go API without package.json", async () => {
    const app = await scaffold("stdlib-api", []);
    assert.ok(app.exists("go.mod"));
    assert.ok(app.exists("cmd/api/main.go"));
    assert.ok(app.exists("internal/bootstrap/app.go"));
    assert.ok(app.exists("internal/bootstrap/featurea.go"));
    assert.ok(app.exists("internal/domain/featurea/item.go"));
    assert.ok(app.exists("internal/application/featurea/create_item.go"));
    assert.ok(app.exists("internal/infrastructure/persistence/featurea/memory_item_repository.go"));
    assert.ok(app.exists("internal/presentation/http/api/v1/featurea/handler.go"));
    assert.ok(app.exists("internal/presentation/http/router.go"));
    assert.ok(app.exists("AGENTS.md"));
    assert.ok(app.exists(".agents/skills/structure-ddd/SKILL.md"));
    assert.ok(app.exists(".agents/skills/structure-ddd/references/feature-a-walkthrough.md"));
    assert.ok(app.exists(".agents/skills/go-stdlib/SKILL.md"));
    assert.ok(!app.exists("package.json"));

    for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
      assert.ok(!app.exists(leaked), `${leaked} must not leak`);
    }

    const goMod = app.read("go.mod");
    assert.match(goMod, new RegExp(`^module example\\.com/${path.basename(app.dir)}$`, "m"));

    if (app.exists(".agents")) {
      const cursor = path.join(app.dir, ".cursor");
      assert.ok(fs.lstatSync(cursor).isSymbolicLink());
      assert.equal(fs.readlinkSync(cursor), ".agents");
    }
  });

  it("rejects TypeScript recipes that lack a stdlib-api overlay", () => {
    expectRejected("stdlib-api", ["biome"]);
    expectRejected("stdlib-api", ["type-orm"]);
  });
});
