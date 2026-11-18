import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  getPreset,
  listPresets,
  loadConfigDefaults,
  removePreset,
  savePreset,
  validatePreset,
} from "../../apps/cli/src/presets.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-presets-test-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

let counter = 0;
function env(): NodeJS.ProcessEnv {
  return { ZEALAKIT_CONFIG_DIR: path.join(root, `cfg-${++counter}`) };
}

describe("presets", () => {
  it("saves, lists and removes user presets", () => {
    const e = env();
    assert.deepEqual(listPresets(root, e), []);
    savePreset(
      "team",
      { template: "next", recipes: ["biome", "zustand"], packageManager: "pnpm" },
      e,
    );
    const [entry] = listPresets(root, e);
    assert.equal(entry?.name, "team");
    assert.equal(entry?.source, "user");
    assert.equal(removePreset("team", e), true);
    assert.equal(removePreset("team", e), false);
  });

  it("lets a project config override a user preset of the same name", () => {
    const e = env();
    savePreset("team", { template: "next" }, e);
    const project = fs.mkdtempSync(path.join(root, "proj-"));
    fs.writeFileSync(
      path.join(project, "zealakit.config.json"),
      JSON.stringify({ presets: { team: { template: "nuxt" } } }),
    );
    const entry = getPreset("team", project, e);
    assert.equal(entry?.source, "project");
    assert.equal(entry?.preset.template, "nuxt");
  });

  it("validates against the registry", () => {
    assert.deepEqual(validatePreset("ok", { template: "next", recipes: ["biome"] }), []);
    assert.ok(validatePreset("bad", { template: "nope" }).length > 0);
    assert.ok(validatePreset("bad", { recipes: ["nope"] }).length > 0);
    assert.ok(validatePreset("bad", { packageManager: "pip" }).length > 0);
    assert.ok(validatePreset("bad name", {}).length > 0);
    assert.throws(() => savePreset("bad", { template: "nope" }, env()));
  });

  it("reports corrupt preset files", () => {
    const e = env();
    const dir = e.ZEALAKIT_CONFIG_DIR as string;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "presets.json"), "{ nope");
    assert.throws(() => listPresets(root, e), /not valid JSON/);
  });
});

describe("config defaults and --config", () => {
  it("merges defaults from user, project and explicit layers (later wins)", () => {
    const e = env();
    const dir = e.ZEALAKIT_CONFIG_DIR as string;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "config.json"),
      JSON.stringify({ defaults: { pm: "yarn", git: true } }),
    );
    const project = fs.mkdtempSync(path.join(root, "proj-"));
    fs.writeFileSync(
      path.join(project, "zealakit.config.json"),
      JSON.stringify({ defaults: { pm: "pnpm" } }),
    );
    assert.deepEqual(loadConfigDefaults(project, e), { packageManager: "pnpm", git: true });

    fs.writeFileSync(
      path.join(project, "extra.json"),
      JSON.stringify({ defaults: { install: false }, presets: { x: { template: "next" } } }),
    );
    assert.deepEqual(loadConfigDefaults(project, e, "extra.json"), {
      packageManager: "pnpm",
      git: true,
      install: false,
    });
    assert.equal(getPreset("x", project, e, "extra.json")?.preset.template, "next");
  });

  it("rejects invalid defaults", () => {
    const project = fs.mkdtempSync(path.join(root, "proj-"));
    fs.writeFileSync(
      path.join(project, "zealakit.config.json"),
      JSON.stringify({ defaults: { pm: "pip" } }),
    );
    assert.throws(() => loadConfigDefaults(project, env()), /defaults\.pm/);
  });

  it("still reads the legacy presets.json and migrates it on save", () => {
    const e = env();
    const dir = e.ZEALAKIT_CONFIG_DIR as string;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "presets.json"),
      JSON.stringify({ presets: { old: { template: "next" } } }),
    );
    assert.equal(getPreset("old", root, e)?.preset.template, "next");
    savePreset("fresh", { template: "nuxt" }, e);
    assert.ok(fs.existsSync(path.join(dir, "config.json")));
    assert.equal(getPreset("old", root, e)?.preset.template, "next");
  });
});
