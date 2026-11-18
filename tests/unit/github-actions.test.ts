import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  applyAddPlan,
  planAddRecipes,
  scaffoldProject,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import { renderGoWorkflow } from "../../packages/ecosystem-go/src/registry/recipes/github-actions-go.js";
import { renderNodeWorkflow } from "../../packages/ecosystem-node/src/registry/recipes/github-actions-workflow.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-gha-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

describe("renderNodeWorkflow", () => {
  it("npm + biome + vitest + docker", () => {
    assert.equal(
      renderNodeWorkflow({
        packageManager: "npm",
        templateId: "next",
        recipeIds: ["biome", "vitest", "docker"],
      }),
      `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install dependencies
        run: if [ -f package-lock.json ]; then npm ci; else npm install; fi
      - name: Lint (Biome)
        run: npm run check
      - name: Test
        run: npm run test
      - name: Build
        run: npm run build
      - name: Build Docker image
        run: docker build -t app .
`,
    );
  });

  it("pnpm enables corepack and uses pnpm commands", () => {
    const yaml = renderNodeWorkflow({
      packageManager: "pnpm",
      templateId: "vite-react",
      recipeIds: ["eslint"],
    });
    assert.match(yaml, /corepack enable/);
    assert.match(yaml, /run: pnpm install/);
    assert.match(yaml, /run: pnpm lint/);
    assert.doesNotMatch(yaml, /Test/);
  });

  it("bun uses the bun setup action; server templates always test", () => {
    const yaml = renderNodeWorkflow({ packageManager: "bun", templateId: "nest", recipeIds: [] });
    assert.match(yaml, /oven-sh\/setup-bun@v2/);
    assert.match(yaml, /run: bun run test/);
  });
});

describe("renderGoWorkflow", () => {
  it("covers vet, test and build, plus Docker when present", () => {
    const base = renderGoWorkflow({ recipeIds: [] });
    assert.match(base, /go vet \.\/\.\.\./);
    assert.match(base, /go test \.\/\.\.\./);
    assert.doesNotMatch(base, /docker build/);
    assert.match(renderGoWorkflow({ recipeIds: ["docker-go"] }), /docker build -t app \./);
  });
});

describe("workflow generation in projects", () => {
  it("scaffolds .github/workflows/ci.yml for Node and Go", async () => {
    const node = await scaffoldProject(
      {
        projectName: "gha-node",
        templateId: "vite-react",
        recipeIds: withDefaultRecipes("client", ["biome", "github-actions"]),
        packageManager: "pnpm",
      },
      workRoot,
    );
    const yaml = fs.readFileSync(path.join(node, ".github/workflows/ci.yml"), "utf-8");
    assert.match(yaml, /pnpm install/);
    assert.match(yaml, /pnpm check/);

    const go = await scaffoldProject(
      {
        projectName: "gha-go",
        templateId: "stdlib-api",
        recipeIds: withDefaultRecipes("server", ["github-actions-go"]),
      },
      workRoot,
    );
    assert.match(fs.readFileSync(path.join(go, ".github/workflows/ci.yml"), "utf-8"), /go vet/);
  });

  it("add github-actions follows the project's package manager", async () => {
    const dir = await scaffoldProject(
      {
        projectName: "gha-add",
        templateId: "vite-react",
        recipeIds: withDefaultRecipes("client", ["biome"]),
      },
      workRoot,
    );
    const plan = planAddRecipes(dir, ["github-actions"], { packageManager: "pnpm" });
    assert.deepEqual(plan.blockers, []);
    applyAddPlan(plan);
    assert.match(
      fs.readFileSync(path.join(dir, ".github/workflows/ci.yml"), "utf-8"),
      /pnpm install/,
    );
  });
});
