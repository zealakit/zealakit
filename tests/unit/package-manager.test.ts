import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptRunCommand, detectPackageManager, getManifestAdapter } from "@zealakit/core/internal";

describe("detectPackageManager", () => {
  const table: Array<[string | undefined, string]> = [
    ["pnpm/9.1.0 npm/? node/v22.12.0 darwin arm64", "pnpm"],
    ["yarn/4.2.0 npm/? node/v22.12.0 linux x64", "yarn"],
    ["bun/1.1.0 npm/? node/v22.12.0 darwin arm64", "bun"],
    ["npm/10.8.0 node/v22.12.0 darwin arm64", "npm"],
    ["something-else/1.0", "npm"],
    ["", "npm"],
    [undefined, "npm"],
  ];
  for (const [agent, expected] of table) {
    it(`${JSON.stringify(agent)} → ${expected}`, () => {
      assert.equal(detectPackageManager(agent), expected);
    });
  }
});

describe("adaptRunCommand", () => {
  it("rewrites npm run scripts per package manager", () => {
    assert.equal(adaptRunCommand("npm run dev", "pnpm"), "pnpm dev");
    assert.equal(adaptRunCommand("npm run dev", "yarn"), "yarn dev");
    assert.equal(adaptRunCommand("npm run dev", "bun"), "bun run dev");
    assert.equal(adaptRunCommand("npm run dev", "npm"), "npm run dev");
    assert.equal(adaptRunCommand("make run", "pnpm"), "make run");
  });
});

describe("adapter nextSteps", () => {
  const node = { projectName: "app", templateId: "vite-react", recipeIds: [] };
  const go = { projectName: "app", templateId: "stdlib-api", recipeIds: [] };

  it("node: install + dev per package manager, install omitted once installed", () => {
    const adapter = getManifestAdapter("node");
    assert.deepEqual(
      adapter.nextSteps(node, { packageManager: "pnpm", installed: false }).commands,
      ["pnpm install", "pnpm dev"],
    );
    assert.deepEqual(adapter.nextSteps(node, { packageManager: "bun", installed: true }).commands, [
      "bun run dev",
    ]);
  });

  it("go: go mod tidy unless already run", () => {
    const adapter = getManifestAdapter("go");
    assert.equal(
      adapter.nextSteps(go, { packageManager: "npm", installed: false }).commands[0],
      "go mod tidy",
    );
    assert.notEqual(
      adapter.nextSteps(go, { packageManager: "npm", installed: true }).commands[0],
      "go mod tidy",
    );
  });
});
