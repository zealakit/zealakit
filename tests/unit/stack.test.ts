import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  buildStackPlan,
  executeStackPlan,
  PACKAGE_ROOT,
  parseStackSpec,
  readProjectManifest,
  readStackManifest,
  stackMemberDir,
} from "@zealakit/core/internal";
import { noColorEnv } from "../helpers/env.js";
import { validateJsonSchema } from "../helpers/json-schema.js";

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-stack-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));
let counter = 0;
const tmp = () => fs.mkdtempSync(path.join(workRoot, `case-${++counter}-`));
const schema = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "schema", `${name}.schema.json`), "utf-8"));

describe("parseStackSpec", () => {
  it("parses members and per-member recipes", () => {
    const parsed = parseStackSpec("web=vite-react,api=hono", ["web:zustand", "api:biome"]);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.members, [
      { name: "web", templateId: "vite-react", recipeIds: ["zustand"] },
      { name: "api", templateId: "hono", recipeIds: ["biome"] },
    ]);
  });

  it("rejects malformed, duplicate, unknown, Go and root-level input", () => {
    for (const [stack, recipes] of [
      ["web", []],
      ["web=next", []],
      ["web=next,web=hono", []],
      ["web=nope,api=hono", []],
      ["web=next,api=stdlib-api", []],
      ["web=next,api=hono", ["ui:mui"]],
      ["web=next,api=hono", ["root:biome"]],
      ["web=next,api=hono", ["mui"]],
    ] as Array<[string, string[]]>) {
      assert.equal(parseStackSpec(stack, recipes).ok, false, `${stack} ${recipes}`);
    }
  });
});

describe("stack workspace", () => {
  function build(pm: "pnpm" | "npm" = "pnpm") {
    const spec = parseStackSpec("web=vite-react,api=hono", ["web:zustand"]);
    assert.ok(spec.ok);
    return buildStackPlan("shop", spec.members, { cwd: tmp(), packageManager: pm });
  }

  it("plans every member through the normal pipeline and reports member blockers", () => {
    const plan = build();
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(
      plan.members.map((member) => member.dir),
      ["apps/web", "apps/api"],
    );
    assert.deepEqual(plan.warnings, []); // a Vite SPA does not listen on 3000

    const servers = parseStackSpec("web=next,api=hono", []);
    assert.ok(servers.ok);
    const warned = buildStackPlan("shop", servers.members, { cwd: tmp() });
    assert.ok(warned.warnings.some((warning) => /port 3000/.test(warning)));

    const bad = parseStackSpec("web=vite-react,api=hono", ["web:biome", "web:eslint"]);
    assert.ok(bad.ok);
    const blocked = buildStackPlan("shop", bad.members, { cwd: tmp() });
    assert.ok(blocked.blockers.some((blocker) => blocker.startsWith("[web]")));
  });

  it("creates apps, shared contracts and a v2 manifest; members stay v1 projects", () => {
    const plan = build();
    const target = executeStackPlan(plan, { overwrite: "refuse" });

    const manifest = readStackManifest(target);
    assert.ok(manifest?.ok);
    assert.equal(manifest.manifest.schemaVersion, 2);
    assert.deepEqual(Object.keys(manifest.manifest.stack), ["web", "api"]);
    assert.deepEqual(validateJsonSchema(manifest.manifest, schema("zealakit-stack")), []);

    assert.ok(fs.existsSync(path.join(target, "pnpm-workspace.yaml")));
    assert.ok(fs.existsSync(path.join(target, "packages/contracts/src/index.ts")));
    const webManifest = readProjectManifest(path.join(target, "apps/web"));
    assert.ok(webManifest?.ok);
    assert.equal(webManifest.manifest.template, "vite-react");
    assert.equal(stackMemberDir(target, manifest.manifest, "api"), path.join(target, "apps/api"));
    assert.equal(stackMemberDir(target, manifest.manifest, "nope"), undefined);

    assert.throws(() => executeStackPlan(plan, { overwrite: "refuse" }), /already exists/);
  });

  it("uses npm workspaces for npm/yarn/bun and pnpm-workspace.yaml for pnpm", () => {
    const npmTarget = executeStackPlan(build("npm"));
    const pkg = JSON.parse(fs.readFileSync(path.join(npmTarget, "package.json"), "utf-8"));
    assert.deepEqual(pkg.workspaces, ["apps/*", "packages/*"]);
    assert.equal(fs.existsSync(path.join(npmTarget, "pnpm-workspace.yaml")), false);
    const pnpmTarget = executeStackPlan(build("pnpm"));
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(pnpmTarget, "package.json"), "utf-8")).workspaces,
      undefined,
    );
  });
});

describe("zealakit create --stack (CLI)", () => {
  function run(args: string[], cwd: string) {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, CLI_ENTRY, ...args], {
      cwd,
      encoding: "utf-8",
      env: noColorEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }

  it("creates a stack, then doctor / add --app / outdated understand it", () => {
    const cwd = tmp();
    const created = run(
      ["create", "shop", "--stack", "web=vite-react,api=hono", "-w", "web:zustand", "-y", "--json"],
      cwd,
    );
    assert.equal(created.status, 0, created.stderr);
    assert.deepEqual(validateJsonSchema(JSON.parse(created.stdout), schema("stack-result")), []);

    const root = path.join(cwd, "shop");
    const doctor = JSON.parse(run(["doctor", "--json", "--cwd", root], cwd).stdout);
    assert.deepEqual(Object.keys(doctor.stack), ["web", "api"]);

    const noApp = run(["add", "vitest", "-y", "--force", "--cwd", root], cwd);
    assert.equal(noApp.status, 2);
    assert.match(noApp.stderr, /--app/);

    const added = run(["add", "vitest", "--app", "web", "-y", "--force", "--cwd", root], cwd);
    assert.equal(added.status, 0, added.stderr);
    assert.ok(fs.existsSync(path.join(root, "apps/web/vitest.config.ts")));
    assert.doesNotMatch(
      fs.readFileSync(path.join(root, "apps/api/package.json"), "utf-8"),
      /jsdom/,
    );

    const outdated = JSON.parse(run(["outdated", "--json", "--cwd", root], cwd).stdout);
    assert.equal(outdated.ok, true);
  });

  it("previews with --dry-run and needs -y otherwise", () => {
    const cwd = tmp();
    const dry = run(["create", "shop", "--stack", "web=vite-react,api=hono", "--dry-run"], cwd);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Stack Preview/);
    assert.equal(fs.existsSync(path.join(cwd, "shop")), false);

    assert.equal(run(["create", "shop", "--stack", "web=vite-react,api=hono"], cwd).status, 2);
    assert.equal(run(["create", "shop", "--stack", "web=vite-react", "-y"], cwd).status, 3);
    assert.equal(
      run(["create", "shop", "--stack", "web=vite-react,api=hono", "-t", "next", "-y"], cwd).status,
      2,
    );
  });
});
