import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createZealakit, type EcosystemRegistration, ScaffoldCommitError } from "@zealakit/core";
import { goEcosystem } from "@zealakit/ecosystem-go";
import { nodeEcosystem } from "@zealakit/ecosystem-node";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-api-combined-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function caseDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("programmatic API — combined registration", () => {
  it("registers both ecosystems and filters metadata", () => {
    const zealakit = createZealakit({ ecosystems: [nodeEcosystem, goEcosystem] });
    assert.deepEqual([...zealakit.ecosystems].sort(), ["go", "node"]);

    const templates = zealakit.metadata.getTemplates();
    assert.ok(templates.some((template) => template.ecosystem === "node"));
    assert.ok(templates.some((template) => template.ecosystem === "go"));

    const goTemplates = zealakit.metadata.getTemplates({ ecosystem: "go" });
    assert.ok(goTemplates.length > 0);
    assert.ok(goTemplates.every((template) => template.ecosystem === "go"));
    assert.deepEqual(zealakit.metadata.getRecipes({ ecosystem: "go" }), []);
  });

  it("rejects duplicate or unknown ecosystem registrations", () => {
    assert.throws(
      () => createZealakit({ ecosystems: [nodeEcosystem, nodeEcosystem] }),
      /Duplicate ecosystem/,
    );
    const unknown = { id: "bun", register: () => {} } as unknown as EcosystemRegistration;
    assert.throws(() => createZealakit({ ecosystems: [unknown] }), /Unknown ecosystem/);
  });

  it("does not duplicate registry entries across instances", () => {
    createZealakit({ ecosystems: [nodeEcosystem, goEcosystem] });
    const second = createZealakit({ ecosystems: [nodeEcosystem] });
    const templateIds = second.metadata.getTemplates().map((template) => template.id);
    assert.equal(new Set(templateIds).size, templateIds.length);
    assert.ok(templateIds.includes("vite-react"));
  });

  it("keeps validation read-only and plans structured output", () => {
    const zealakit = createZealakit({ ecosystems: [nodeEcosystem] });
    const cwd = caseDir();
    const plan = zealakit.scaffold.plan(
      { projectName: "app", templateId: "next", recipeIds: ["biome", "shadcn-ui"] },
      { cwd },
    );
    assert.deepEqual(plan.blockers, []);
    assert.ok(plan.packages.addedDependencies.length > 0);
    assert.ok(plan.checks.some((check) => check.id === "config-validation"));
    assert.equal(fs.existsSync(path.join(cwd, "app")), false);
  });

  it("propagates commit failures without leaving partial output", {
    skip:
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0),
  }, async () => {
    const zealakit = createZealakit({ ecosystems: [nodeEcosystem] });
    const cwd = caseDir();
    fs.chmodSync(cwd, 0o500);
    try {
      await assert.rejects(
        () =>
          zealakit.scaffold.create(
            { projectName: "app", templateId: "vite-react", recipeIds: [] },
            { cwd },
          ),
        ScaffoldCommitError,
      );
      assert.equal(fs.existsSync(path.join(cwd, "app")), false);
    } finally {
      fs.chmodSync(cwd, 0o700);
    }
  });
});
