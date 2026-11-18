import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { PACKAGE_ROOT } from "@zealakit/core/internal";
import { noColorEnv } from "../helpers/env.js";

/**
 * Stability contract: CLI commands and flags. `--help` output is snapshotted in
 * tests/fixtures/help/. A diff means a command or flag changed — if intended,
 * regenerate with UPDATE_SNAPSHOTS=1 and add a CHANGELOG "Breaking" note when a
 * flag or command was removed or renamed (docs/stability.md).
 */

const require = createRequire(path.join(PACKAGE_ROOT, "package.json"));
const TSX_LOADER = require.resolve("tsx");
const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");
const FIXTURES = path.join(PACKAGE_ROOT, "tests/fixtures/help");

const COMMANDS: Array<[string, string[]]> = [
  ["root", []],
  ["create", ["create"]],
  ["add", ["add"]],
  ["info", ["info"]],
  ["doctor", ["doctor"]],
  ["outdated", ["outdated"]],
  ["preset", ["preset"]],
  ["preset-save", ["preset", "save"]],
  ["discovery", ["discovery"]],
];

function help(args: string[]): string {
  const result = spawnSync(
    process.execPath,
    ["--import", TSX_LOADER, CLI_ENTRY, ...args, "--help"],
    {
      encoding: "utf-8",
      env: { ...noColorEnv(), COLUMNS: "100" },
      timeout: 60_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

describe("CLI help snapshots", () => {
  for (const [name, args] of COMMANDS) {
    it(`zealakit ${args.join(" ") || "(root)"} --help`, () => {
      const actual = help(args);
      const file = path.join(FIXTURES, `${name}.txt`);
      if (process.env.UPDATE_SNAPSHOTS === "1") {
        fs.mkdirSync(FIXTURES, { recursive: true });
        fs.writeFileSync(file, actual);
      }
      assert.ok(fs.existsSync(file), `missing snapshot ${file}; run with UPDATE_SNAPSHOTS=1`);
      assert.equal(actual, fs.readFileSync(file, "utf-8"));
    });
  }
});
