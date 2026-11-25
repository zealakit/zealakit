import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  buildProjectManifest,
  PACKAGE_ROOT,
  parseProjectManifest,
  readProjectManifest,
} from "@zealakit/core/internal";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-manifest-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

const sample = buildProjectManifest({
  ecosystem: "node",
  template: "next",
  recipes: ["biome", "mui"],
  requestedRecipes: ["mui"],
  kitVersion: "1.0.0-beta.4",
  createdAt: "2026-12-01T10:00:00.000Z",
});

describe("project manifest", () => {
  it("round-trips through parse", () => {
    const parsed = parseProjectManifest(JSON.parse(JSON.stringify(sample)));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.manifest, sample);
    assert.match(sample.$schema, /zealakit@1\.0\.0-beta\.4\/schema\/zealakit\.schema\.json$/);
  });

  it("rejects malformed documents without throwing", () => {
    for (const bad of [
      null,
      [],
      { ...sample, schemaVersion: 2 },
      { ...sample, recipes: "x" },
      { ...sample, ecosystem: "rust" },
    ]) {
      const parsed = parseProjectManifest(bad);
      assert.equal(parsed.ok, false);
    }
  });

  it("reads from disk, reports invalid JSON, and returns undefined when absent", () => {
    assert.equal(readProjectManifest(workRoot), undefined);
    fs.writeFileSync(path.join(workRoot, "zealakit.json"), "{ nope");
    const broken = readProjectManifest(workRoot);
    assert.equal(broken?.ok, false);
    fs.writeFileSync(path.join(workRoot, "zealakit.json"), JSON.stringify(sample));
    assert.equal(readProjectManifest(workRoot)?.ok, true);
  });

  it("ships a JSON schema whose required fields match the manifest", () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, "schema/zealakit.schema.json"), "utf-8"),
    ) as { required: string[]; properties: Record<string, unknown> };
    for (const key of Object.keys(sample)) {
      assert.ok(key in schema.properties, `schema is missing '${key}'`);
    }
    for (const key of schema.required) {
      assert.ok(key in sample, `manifest is missing required '${key}'`);
    }
  });
});
