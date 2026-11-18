import "../register.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { PACKAGE_ROOT } from "@zealakit/core/internal";
import { createMcpServer, resolveInsideRoot } from "../../apps/mcp/src/server.js";
import { noColorEnv } from "../helpers/env.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-mcp-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));
let counter = 0;
const newRoot = () => fs.mkdtempSync(path.join(workRoot, `root-${++counter}-`));

async function call(server: ReturnType<typeof createMcpServer>, name: string, args: object = {}) {
  const response = (await server.handle({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  })) as { result: { isError?: boolean; content: Array<{ text: string }> } };
  const text = response.result.content[0]?.text ?? "";
  return { isError: response.result.isError === true, text, json: () => JSON.parse(text) };
}

describe("MCP protocol", () => {
  const server = createMcpServer({ root: newRoot(), version: "0.0.0-test" });

  it("initializes, lists tools and answers ping", async () => {
    const init = (await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    })) as { result: { serverInfo: { name: string }; capabilities: object } };
    assert.equal(init.result.serverInfo.name, "zealakit");
    assert.ok("tools" in init.result.capabilities);

    const list = (await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as {
      result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> };
    };
    const names = list.result.tools.map((tool) => tool.name);
    assert.deepEqual(names, [
      "list_templates",
      "list_recipes",
      "recommend",
      "plan",
      "create",
      "add",
      "doctor",
      "outdated",
    ]);
    assert.equal(
      list.result.tools.find((tool) => tool.name === "plan")?.annotations.readOnlyHint,
      true,
    );
    assert.equal(
      list.result.tools.find((tool) => tool.name === "create")?.annotations.readOnlyHint,
      false,
    );

    assert.deepEqual(await server.handle({ jsonrpc: "2.0", id: 3, method: "ping" }), {
      jsonrpc: "2.0",
      id: 3,
      result: {},
    });
  });

  it("ignores notifications and reports unknown methods and bad requests", async () => {
    assert.equal(
      await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }),
      undefined,
    );
    const unknown = (await server.handle({ jsonrpc: "2.0", id: 9, method: "nope" })) as {
      error: { code: number };
    };
    assert.equal(unknown.error.code, -32601);
    const invalid = (await server.handle([])) as { error: { code: number } };
    assert.equal(invalid.error.code, -32600);
  });
});

describe("MCP tools", () => {
  it("lists metadata and plans without writing", async () => {
    const root = newRoot();
    const server = createMcpServer({ root, version: "t" });
    const templates = (await call(server, "list_templates", { ecosystem: "go" })).json() as Array<{
      id: string;
    }>;
    assert.ok(templates.some((template) => template.id === "stdlib-api"));
    const recipes = (await call(server, "list_recipes", { templateId: "nest" })).json() as Array<{
      id: string;
    }>;
    assert.ok(recipes.length > 0);

    const plan = (
      await call(server, "plan", {
        projectName: "p",
        templateId: "vite-react",
        recipeIds: ["biome"],
      })
    ).json();
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("create needs confirm: true, refuses non-empty targets, and stays inside the root", async () => {
    const root = newRoot();
    const server = createMcpServer({ root, version: "t" });
    const args = { projectName: "app", templateId: "vite-react", recipeIds: ["biome"] };

    const unconfirmed = await call(server, "create", args);
    assert.equal(unconfirmed.isError, true);
    assert.match(unconfirmed.text, /confirm: true/);
    assert.equal(fs.existsSync(path.join(root, "app")), false);

    const created = await call(server, "create", { ...args, confirm: true });
    assert.equal(created.isError, false, created.text);
    assert.equal(created.json().outputDirectory, "app");
    assert.ok(fs.existsSync(path.join(root, "app/zealakit.json")));

    assert.equal((await call(server, "create", { ...args, confirm: true })).isError, true);
    assert.match(
      (await call(server, "create", { ...args, projectName: "../escape", confirm: true })).text,
      /outside the allowed root/,
    );
    assert.equal(fs.existsSync(path.join(root, "..", "escape")), false);
  });

  it("add is a dry run by default and applies only with dryRun: false", async () => {
    const root = newRoot();
    const server = createMcpServer({ root, version: "t" });
    await call(server, "create", { projectName: "app", templateId: "vite-react", confirm: true });

    const dry = (await call(server, "add", { projectDir: "app", recipeIds: ["zustand"] })).json();
    assert.equal(dry.applied, false);
    assert.ok(
      dry.changes.some(
        (change: { path: string }) => change.path === "src/stores/something.store.ts",
      ),
    );
    assert.equal(fs.existsSync(path.join(root, "app/src/stores")), false);

    const applied = (
      await call(server, "add", { projectDir: "app", recipeIds: ["zustand"], dryRun: false })
    ).json();
    assert.equal(applied.applied, true);
    assert.ok(fs.existsSync(path.join(root, "app/src/stores/something.store.ts")));

    const report = (await call(server, "doctor", { projectDir: "app" })).json();
    assert.equal(report.isZealakitProject, true);
    assert.deepEqual((await call(server, "outdated", { projectDir: "app" })).json().blockers, []);
  });

  it("rejects unknown tools, absolute paths and symlinks that leave the root", async () => {
    const root = newRoot();
    const server = createMcpServer({ root, version: "t" });
    assert.equal((await call(server, "nope")).isError, true);
    assert.equal((await call(server, "doctor", { projectDir: "/etc" })).isError, true);

    const outside = newRoot();
    fs.symlinkSync(outside, path.join(root, "link"));
    assert.throws(() => resolveInsideRoot(root, "link/app"), /resolves outside/);
  });

  it("returns structured Discovery errors as tool errors", async () => {
    const server = createMcpServer({ root: newRoot(), version: "t" });
    const bad = await call(server, "recommend", { answers: { projectType: "nope" } });
    assert.equal(bad.isError, true);
  });
});

describe("zealakit mcp over stdio", () => {
  it("speaks newline-delimited JSON-RPC and keeps stdout clean", async () => {
    const root = newRoot();
    const child = spawn(
      process.execPath,
      ["--import", TSX_LOADER, CLI_ENTRY, "mcp", "--root", root],
      {
        env: noColorEnv(),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const lines: string[] = [];
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      const parts = stdout.split("\n");
      stdout = parts.pop() ?? "";
      lines.push(...parts.filter(Boolean));
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    child.stdin.write("not json\n");
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
    child.stdin.end();
    await new Promise<void>((resolve) => child.on("close", () => resolve()));

    const messages = lines.map((line) => JSON.parse(line));
    assert.equal(messages.length, 3);
    assert.equal(messages.find((m) => m.id === 1)?.result.serverInfo.name, "zealakit");
    assert.equal(messages.find((m) => m.id === null)?.error.code, -32700);
    assert.equal(messages.find((m) => m.id === 2)?.result.tools.length, 8);
  });
});
