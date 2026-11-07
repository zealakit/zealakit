import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { ExitCode, PACKAGE_ROOT } from "@zealakit/core";
import type { GoEnvironmentReport } from "@zealakit/ecosystem-go";
import { type DoctorOptions, doctorExitCode } from "../../apps/cli/src/doctor.js";

const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

function goReport(partial: Partial<GoEnvironmentReport>): GoEnvironmentReport {
  return {
    available: false,
    status: "missing",
    message: "missing",
    issues: [],
    ...partial,
  };
}

describe("doctorExitCode", () => {
  it("exits 0 when node is ready and go is missing (optional)", () => {
    const code = doctorExitCode({
      zealakit: { name: "zealakit", version: "1.0.0" },
      node: {
        runtime: "node",
        status: "ready",
        version: "v22.0.0",
        message: "ok",
      },
      go: goReport({ status: "missing" }),
    });
    assert.equal(code, ExitCode.OK);
  });

  it("exits validation when --min-go-version is set and go is missing", () => {
    const options: DoctorOptions = { minGoVersion: "1.22.0" };
    const code = doctorExitCode(
      {
        zealakit: { name: "zealakit", version: "1.0.0" },
        node: {
          runtime: "node",
          status: "ready",
          version: "v22.0.0",
          message: "ok",
        },
        go: goReport({ status: "missing", minimumVersion: "1.22.0" }),
      },
      options,
    );
    assert.equal(code, ExitCode.VALIDATION);
  });

  it("exits validation when go is incompatible under --min-go-version", () => {
    const code = doctorExitCode(
      {
        zealakit: { name: "zealakit", version: "1.0.0" },
        node: {
          runtime: "node",
          status: "ready",
          version: "v22.0.0",
          message: "ok",
        },
        go: goReport({
          available: true,
          status: "incompatible",
          version: "1.21.0",
          minimumVersion: "1.22.0",
          message: "too old",
        }),
      },
      { minGoVersion: "1.22.0" },
    );
    assert.equal(code, ExitCode.VALIDATION);
  });

  it("exits internal on detection error", () => {
    const code = doctorExitCode({
      zealakit: { name: "zealakit", version: "1.0.0" },
      node: {
        runtime: "node",
        status: "ready",
        version: "v22.0.0",
        message: "ok",
      },
      go: goReport({ status: "error", message: "boom" }),
    });
    assert.equal(code, ExitCode.INTERNAL);
  });
});

describe("zealakit doctor", () => {
  it("prints a human report and exits 0 without requiring Go", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, "doctor"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Zealakit Environment Check/);
    assert.match(result.stdout, /Go Environment/);
    assert.match(result.stdout, /Status:/);
  });

  it("prints JSON with --json", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, "doctor", "--json"], {
      cwd: PACKAGE_ROOT,
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout) as {
      go: { status: string };
      node: { status: string };
      zealakit: { name: string };
    };
    assert.equal(data.zealakit.name, "zealakit");
    assert.ok(["ready", "missing", "incompatible", "error"].includes(data.go.status));
    assert.equal(data.node.status, "ready");
  });
});
