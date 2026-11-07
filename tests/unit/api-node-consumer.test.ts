import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  createZealakit,
  DISCOVERY_API_SCHEMA_VERSION,
  handleDiscoveryRequest,
  ScaffoldValidationError,
} from "@zealakit/core";
import { nodeEcosystem } from "@zealakit/ecosystem-node";

const zealakit = createZealakit({ ecosystems: [nodeEcosystem] });
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-api-node-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("programmatic API — Node-only consumer", () => {
  it("registers only the requested ecosystem and exposes metadata", () => {
    assert.deepEqual(zealakit.ecosystems, ["node"]);
    const templates = zealakit.metadata.getTemplates();
    assert.ok(templates.length >= 8);
    assert.ok(templates.every((template) => template.ecosystem === "node"));
    assert.ok(zealakit.metadata.getRecipes().length > 0);
    assert.deepEqual(zealakit.metadata.getRecipes({ ecosystem: "go" }), []);
  });

  it("returns safely detached metadata", () => {
    const templates = zealakit.metadata.getTemplates({ templateId: "vite-react" });
    const first = templates[0];
    assert.ok(first);
    first.compatibleRecipes.push("mutated");
    first.discovery = undefined;

    const again = zealakit.metadata.getTemplates({ templateId: "vite-react" });
    assert.ok(again[0]);
    assert.ok(!again[0].compatibleRecipes.includes("mutated"));
  });

  it("matches the JSON Discovery contract", async () => {
    const answers = {
      projectType: "server-api" as const,
      backendRuntime: "node" as const,
      apiStorageNeed: "none" as const,
    };
    const questions = await zealakit.discovery.getQuestions({ answers: {} });
    assert.equal(questions.question?.id, "projectType");

    const recommendations = await zealakit.discovery.getRecommendations({ answers });
    const json = await handleDiscoveryRequest({
      schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
      operation: "recommendations",
      answers,
    });
    assert.equal(json.ok, true);
    if (!json.ok) return;
    assert.deepEqual(recommendations, json.data);

    const validation = await zealakit.discovery.validateSelection({
      answers,
      selection: { templateId: "nest", recipeIds: ["biome"] },
    });
    assert.equal(validation.valid, true);
  });

  it("plans without writing files", () => {
    const cwd = caseDir();
    const plan = zealakit.scaffold.plan(
      { projectName: "my-app", templateId: "vite-react", recipeIds: [] },
      { cwd },
    );
    assert.deepEqual(plan.blockers, []);
    assert.ok(plan.files.length > 0);
    assert.equal(plan.destinationExists, false);
    assert.equal(fs.existsSync(path.join(cwd, "my-app")), false);
  });

  it("executes a valid scaffold through the real pipeline", async () => {
    const cwd = caseDir();
    const result = await zealakit.scaffold.create(
      { projectName: "my-app", templateId: "vite-react", recipeIds: [] },
      { cwd },
    );

    assert.equal(result.projectName, "my-app");
    assert.equal(result.templateId, "vite-react");
    assert.equal(result.outputDirectory, path.join(cwd, "my-app"));
    const pkg = JSON.parse(
      fs.readFileSync(path.join(result.outputDirectory, "package.json"), "utf-8"),
    ) as { name: string };
    assert.equal(pkg.name, "my-app");
    assert.equal(fs.readlinkSync(path.join(result.outputDirectory, ".cursor")), ".agents");
  });

  it("fails safely for invalid configuration and non-empty targets", async () => {
    const cwd = caseDir();
    await assert.rejects(
      () =>
        zealakit.scaffold.create(
          { projectName: "bad", templateId: "nope", recipeIds: [] },
          { cwd },
        ),
      ScaffoldValidationError,
    );

    fs.mkdirSync(path.join(cwd, "existing"));
    fs.writeFileSync(path.join(cwd, "existing", "keep.txt"), "user");
    await assert.rejects(
      () =>
        zealakit.scaffold.create(
          { projectName: "existing", templateId: "vite-react", recipeIds: [] },
          { cwd },
        ),
      ScaffoldValidationError,
    );
    assert.equal(fs.readFileSync(path.join(cwd, "existing", "keep.txt"), "utf-8"), "user");
  });

  it("throws structured Discovery errors", async () => {
    await assert.rejects(
      () =>
        zealakit.discovery.getRecommendations({
          answers: { projectType: "nope" as never },
        }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "INVALID_ANSWERS",
    );
  });
});
