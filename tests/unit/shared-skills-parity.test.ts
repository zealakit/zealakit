import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PACKAGE_ROOT } from "@zealakit/core/internal";

/**
 * The `repo-docs` skill is authored once in `recipes/_shared/` and copied into
 * every docs recipe. A hand-edited copy drifts silently, so this test fails on
 * any difference. Run `pnpm sync:skills` after editing the canonical source.
 */

const SHARED = path.join(PACKAGE_ROOT, "recipes/_shared/repo-docs");
const SKILL_PATH = ".agents/skills/repo-docs";
const TARGETS = ["recipes/node/docs", "recipes/go/docs-go", "recipes/python/docs-python"];

function listFiles(dir: string, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

describe("repo-docs shared skill parity", () => {
  it("has a canonical source", () => {
    assert.ok(fs.existsSync(path.join(SHARED, "SKILL.md")));
    assert.ok(fs.existsSync(path.join(SHARED, "check-docs.mjs")));
    assert.ok(fs.existsSync(path.join(SHARED, "profile.schema.json")));
  });

  for (const target of TARGETS) {
    it(`${target} ships a byte-identical copy`, () => {
      const destination = path.join(PACKAGE_ROOT, target, SKILL_PATH);
      const expected = listFiles(SHARED);
      const actual = listFiles(destination);
      assert.deepEqual(actual, expected, `${target}: file list differs`);
      for (const relative of expected) {
        assert.deepEqual(
          fs.readFileSync(path.join(destination, relative)),
          fs.readFileSync(path.join(SHARED, relative)),
          `${target}/${SKILL_PATH}/${relative} differs from recipes/_shared/repo-docs`,
        );
      }
    });

    it(`${target} keeps .cursor -> .agents`, () => {
      const cursor = path.join(PACKAGE_ROOT, target, ".cursor");
      assert.ok(fs.lstatSync(cursor).isSymbolicLink(), `${cursor} must be a symlink`);
      assert.equal(fs.readlinkSync(cursor), ".agents");
    });
  }
});
