import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiResponse,
  type DiscoveryScaffoldData,
  getRecipe,
  handleDiscoveryRequest,
} from "@zealakit/core";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-scaffold-api-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function tempDir(): string {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

type ScaffoldOverrides = {
  answers?: Record<string, unknown>;
  selection?: Record<string, unknown>;
  project?: Record<string, unknown>;
  confirmation?: Record<string, unknown>;
};

function request(overrides: ScaffoldOverrides = {}): Record<string, unknown> {
  return {
    schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
    operation: "scaffold",
    answers: { projectType: "ui", uiTechPreference: "react" },
    selection: { templateId: "vite-react", recipeIds: [] },
    project: { name: "my-app" },
    confirmation: { confirmed: true },
    ...overrides,
  };
}

async function scaffold(
  cwd: string,
  overrides: ScaffoldOverrides = {},
): Promise<DiscoveryApiResponse> {
  return handleDiscoveryRequest(request(overrides), { cwd });
}

function scaffoldData(response: DiscoveryApiResponse): DiscoveryScaffoldData {
  assert.equal(response.ok, true);
  assert.equal(response.operation, "scaffold");
  return (response as Extract<DiscoveryApiResponse, { operation: "scaffold" }>).data;
}

function errorCode(response: DiscoveryApiResponse): string {
  assert.equal(response.ok, false);
  return (response as Extract<DiscoveryApiResponse, { ok: false }>).error.code;
}

describe("Discovery API — scaffold confirmation", () => {
  it("does not scaffold without confirmation", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, { confirmation: undefined });
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.CONFIRMATION_REQUIRED);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("does not scaffold when confirmation is false", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, { confirmation: { confirmed: false } });
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.CONFIRMATION_REQUIRED);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("scaffolds through the existing pipeline when confirmed", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd);
    const data = scaffoldData(response);

    assert.equal(data.projectName, "my-app");
    assert.equal(data.templateId, "vite-react");
    assert.ok(data.recipeIds.includes("client-shared-pieces"));
    assert.equal(data.outputDirectory, "my-app");
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "my-app", "package.json"), "utf-8")) as {
      name: string;
    };
    assert.equal(pkg.name, "my-app");
  });

  it("honors an explicit directory when its basename matches the project name", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, {
      project: { name: "my-app", directory: "nested/my-app" },
    });
    const data = scaffoldData(response);
    assert.equal(data.outputDirectory, "nested/my-app");
    assert.ok(fs.existsSync(path.join(cwd, "nested", "my-app", "package.json")));
  });

  it("rejects a directory whose basename differs from the project name", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, {
      project: { name: "my-app", directory: "other-dir" },
    });
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("rejects invalid project names", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, { project: { name: "Bad Name" } });
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.PROJECT_NAME_INVALID);
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("echoes the operation on structured request errors", async () => {
    const cwd = tempDir();
    const missingConfirmation = await scaffold(cwd, { confirmation: undefined });
    assert.equal(missingConfirmation.operation, "scaffold");

    const badSelection = await handleDiscoveryRequest(
      {
        schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
        operation: "validate",
        selection: { templateId: "nest", recipeIds: "biome" },
      },
      { cwd },
    );
    assert.equal(badSelection.ok, false);
    assert.equal(badSelection.operation, "validate");
  });
});

describe("Discovery API — scaffold safety", () => {
  it("allows an existing empty target directory", async () => {
    const cwd = tempDir();
    fs.mkdirSync(path.join(cwd, "my-app"));
    const response = await scaffold(cwd);
    assert.equal(scaffoldData(response).outputDirectory, "my-app");
  });

  it("never overwrites an existing project on repeated requests", async () => {
    const cwd = tempDir();
    const first = await scaffold(cwd);
    assert.equal(first.ok, true);
    const second = await scaffold(cwd);
    assert.equal(errorCode(second), DISCOVERY_API_ERROR_CODES.TARGET_EXISTS);
    assert.ok(fs.existsSync(path.join(cwd, "my-app", "package.json")));
  });

  it("rejects scaffolding over the working directory or its parents", async () => {
    const cwd = tempDir();
    const response = await scaffold(cwd, { project: { name: path.basename(cwd), directory: "." } });
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.INVALID_PROJECT_DIRECTORY);
  });

  it("does not leak absolute staging paths in validation errors", async () => {
    const cwd = tempDir();
    const outside = tempDir();
    const recipe = getRecipe("biome");
    assert.ok(recipe);
    const original = recipe.finalize;
    recipe.finalize = (targetDir: string) => {
      fs.symlinkSync(outside, path.join(targetDir, "escape"), "dir");
    };
    try {
      const response = await scaffold(cwd, {
        selection: { templateId: "vite-react", recipeIds: ["biome"] },
      });
      assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.SCAFFOLD_VALIDATION_FAILED);
      const error = response as Extract<DiscoveryApiResponse, { ok: false }>;
      assert.ok(error.error.details.some((detail) => detail.includes("<path>")));
      assert.ok(!error.error.details.some((detail) => detail.includes(outside)));
      assert.deepEqual(fs.readdirSync(cwd), []);
    } finally {
      recipe.finalize = original;
    }
  });

  it("refuses a non-empty target without touching it", async () => {
    const cwd = tempDir();
    fs.mkdirSync(path.join(cwd, "my-app"));
    fs.writeFileSync(path.join(cwd, "my-app", "keep.txt"), "user data");
    const response = await scaffold(cwd);
    assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.TARGET_EXISTS);
    assert.equal(fs.readFileSync(path.join(cwd, "my-app", "keep.txt"), "utf-8"), "user data");
  });

  it("rejects invalid or unknown selections before writing", async () => {
    const cwd = tempDir();

    const incompatible = await scaffold(cwd, {
      selection: { templateId: "next", recipeIds: ["pinia"] },
    });
    assert.equal(errorCode(incompatible), DISCOVERY_API_ERROR_CODES.SELECTION_INVALID);

    const unknownTemplate = await scaffold(cwd, {
      selection: { templateId: "nope", recipeIds: [] },
    });
    assert.equal(errorCode(unknownTemplate), DISCOVERY_API_ERROR_CODES.UNKNOWN_TEMPLATE);

    const unknownRecipe = await scaffold(cwd, {
      selection: { templateId: "vite-react", recipeIds: ["nope"] },
    });
    assert.equal(errorCode(unknownRecipe), DISCOVERY_API_ERROR_CODES.UNKNOWN_RECIPE);

    const answersMismatch = await scaffold(cwd, {
      answers: { projectType: "ui", uiTechPreference: "vue" },
      selection: { templateId: "next", recipeIds: [] },
    });
    assert.equal(errorCode(answersMismatch), DISCOVERY_API_ERROR_CODES.SELECTION_INVALID);

    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("keeps recommendations and validation read-only", async () => {
    const cwd = tempDir();
    await handleDiscoveryRequest(
      {
        schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
        operation: "recommendations",
        answers: { projectType: "server-api", apiStorageNeed: "none" },
      },
      { cwd },
    );
    await handleDiscoveryRequest(
      {
        schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
        operation: "validate",
        selection: { templateId: "nest", recipeIds: [] },
      },
      { cwd },
    );
    assert.deepEqual(fs.readdirSync(cwd), []);
  });

  it("returns SCAFFOLD_FAILED when the pipeline fails", async () => {
    const cwd = tempDir();
    const recipe = getRecipe("biome");
    assert.ok(recipe);
    const original = recipe.finalize;
    recipe.finalize = () => {
      throw new Error("simulated scaffold failure");
    };
    try {
      const response = await scaffold(cwd, {
        selection: { templateId: "vite-react", recipeIds: ["biome"] },
      });
      assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.SCAFFOLD_FAILED);
      assert.deepEqual(fs.readdirSync(cwd), []);
    } finally {
      recipe.finalize = original;
    }
  });

  it("returns SCAFFOLD_VALIDATION_FAILED for invalid generated output", async () => {
    const cwd = tempDir();
    const recipe = getRecipe("biome");
    assert.ok(recipe);
    const original = recipe.finalize;
    recipe.finalize = (targetDir: string) => {
      fs.rmSync(path.join(targetDir, ".agents"), { recursive: true, force: true });
    };
    try {
      const response = await scaffold(cwd, {
        selection: { templateId: "vite-react", recipeIds: ["biome"] },
      });
      assert.equal(errorCode(response), DISCOVERY_API_ERROR_CODES.SCAFFOLD_VALIDATION_FAILED);
      assert.deepEqual(fs.readdirSync(cwd), []);
    } finally {
      recipe.finalize = original;
    }
  });
});
