import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createZealakit } from "@zealakit/core";
import { goEcosystem } from "@zealakit/ecosystem-go";

const zealakit = createZealakit({ ecosystems: [goEcosystem] });
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-api-go-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("programmatic API — Go-only consumer", () => {
  it("registers only the Go ecosystem", () => {
    assert.deepEqual(zealakit.ecosystems, ["go"]);
    const templates = zealakit.metadata.getTemplates();
    assert.ok(templates.length >= 3);
    assert.ok(templates.every((template) => template.ecosystem === "go"));
    const recipes = zealakit.metadata.getRecipes();
    assert.ok(recipes.length > 0);
    assert.ok(recipes.every((recipe) => recipe.ecosystem === "go"));
  });

  it("supports Discovery for Go backends", async () => {
    const recommendations = await zealakit.discovery.getRecommendations({
      answers: { projectType: "server-api", backendRuntime: "go", apiStorageNeed: "none" },
    });
    assert.ok(["gin-api", "stdlib-api"].includes(recommendations.recommendedTemplateId ?? ""));
    const validation = await zealakit.discovery.validateSelection({
      selection: { templateId: "gin-api", recipeIds: [] },
    });
    assert.equal(validation.valid, true);
  });

  it("plans without writing files", () => {
    const cwd = caseDir();
    const plan = zealakit.scaffold.plan(
      { projectName: "go-app", templateId: "stdlib-api", recipeIds: [] },
      { cwd },
    );
    assert.deepEqual(plan.blockers, []);
    assert.equal(fs.existsSync(path.join(cwd, "go-app")), false);
  });

  it("executes a Go scaffold with the module rewrite", async () => {
    const cwd = caseDir();
    const result = await zealakit.scaffold.create(
      { projectName: "go-app", templateId: "stdlib-api", recipeIds: [] },
      { cwd },
    );
    const goMod = fs.readFileSync(path.join(result.outputDirectory, "go.mod"), "utf-8");
    assert.match(goMod, /^module\s+\S*go-app/m);
    assert.equal(fs.existsSync(path.join(result.outputDirectory, "package.json")), false);
    assert.equal(fs.readlinkSync(path.join(result.outputDirectory, ".cursor")), ".agents");
  });
});
