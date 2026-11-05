import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  detectGoEnvironment,
  type RunCommand,
  type RunCommandResult,
  resolveGoExecutable,
} from "@zealakit/ecosystem-go";

function ok(stdout: string, stderr = ""): RunCommandResult {
  return { exitCode: 0, stdout, stderr };
}

function fail(exitCode: number, stderr = "", stdout = ""): RunCommandResult {
  return { exitCode, stdout, stderr };
}

describe("detectGoEnvironment", () => {
  it("reports missing when executable is absent", async () => {
    const report = await detectGoEnvironment({
      resolveExecutable: () => undefined,
      runCommand: async () => {
        throw new Error("should not run");
      },
    });
    assert.equal(report.status, "missing");
    assert.equal(report.available, false);
    assert.match(report.message, /not installed/i);
    assert.match(report.message, /TypeScript templates/i);
  });

  it("reports ready with env details when go version and env succeed", async () => {
    const runCommand: RunCommand = async (_file, args) => {
      if (args[0] === "version") {
        return ok("go version go1.25.1 darwin/arm64\n");
      }
      if (args[0] === "env" && args[1] === "-json") {
        return ok(
          JSON.stringify({
            GOROOT: "/usr/local/go",
            GOPATH: "/Users/user/go",
            GOMODCACHE: "/Users/user/go/pkg/mod",
            GOOS: "darwin",
            GOARCH: "arm64",
          }),
        );
      }
      return fail(1, "unexpected");
    };

    const report = await detectGoEnvironment({
      resolveExecutable: () => "/usr/local/go/bin/go",
      runCommand,
    });

    assert.equal(report.status, "ready");
    assert.equal(report.available, true);
    assert.equal(report.version, "1.25.1");
    assert.equal(report.versionLabel, "go1.25.1");
    assert.equal(report.executablePath, "/usr/local/go/bin/go");
    assert.equal(report.goroot, "/usr/local/go");
    assert.equal(report.gopath, "/Users/user/go");
    assert.equal(report.gomodcache, "/Users/user/go/pkg/mod");
    assert.equal(report.goos, "darwin");
    assert.equal(report.goarch, "arm64");
  });

  it("treats optional env keys as optional", async () => {
    const runCommand: RunCommand = async (_file, args) => {
      if (args[0] === "version") return ok("go version go1.22.0 linux/amd64\n");
      if (args[0] === "env" && args[1] === "-json") {
        return ok(JSON.stringify({ GOOS: "linux", GOARCH: "amd64" }));
      }
      return fail(1);
    };
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/usr/bin/go",
      runCommand,
    });
    assert.equal(report.status, "ready");
    assert.equal(report.goroot, undefined);
    assert.equal(report.gopath, undefined);
    assert.equal(report.goos, "linux");
  });

  it("marks incompatible when below minimum version", async () => {
    const runCommand: RunCommand = async (_file, args) => {
      if (args[0] === "version") return ok("go version go1.21.0 linux/amd64\n");
      if (args[0] === "env" && args[1] === "-json") return ok("{}");
      return fail(1);
    };
    const report = await detectGoEnvironment({
      minimumVersion: "1.22.0",
      resolveExecutable: () => "/usr/bin/go",
      runCommand,
    });
    assert.equal(report.status, "incompatible");
    assert.equal(report.available, true);
    assert.equal(report.minimumVersion, "1.22.0");
    assert.match(report.message, /does not satisfy/i);
  });

  it("marks ready when version satisfies minimum", async () => {
    const runCommand: RunCommand = async (_file, args) => {
      if (args[0] === "version") return ok("go version go1.22.5 linux/amd64\n");
      if (args[0] === "env" && args[1] === "-json") return ok("{}");
      return fail(1);
    };
    const report = await detectGoEnvironment({
      minimumVersion: "1.22.0",
      resolveExecutable: () => "/usr/bin/go",
      runCommand,
    });
    assert.equal(report.status, "ready");
  });

  it("reports error when go version output is malformed", async () => {
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/usr/bin/go",
      runCommand: async () => ok("not a go version line\n"),
    });
    assert.equal(report.status, "error");
    assert.match(report.message, /Could not parse Go version/i);
  });

  it("reports error when go version execution fails", async () => {
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/usr/bin/go",
      runCommand: async () => fail(2, "boom"),
    });
    assert.equal(report.status, "error");
    assert.match(report.message, /failed/i);
  });

  it("reports missing on ENOENT spawn error", async () => {
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/missing/go",
      runCommand: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
        spawnError: Object.assign(new Error("not found"), { code: "ENOENT" }),
      }),
    });
    assert.equal(report.status, "missing");
  });

  it("reports error on timeout", async () => {
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/usr/bin/go",
      runCommand: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
        timedOut: true,
      }),
    });
    assert.equal(report.status, "error");
    assert.match(report.message, /timed out/i);
  });

  it("falls back to text go env when -json is empty", async () => {
    const runCommand: RunCommand = async (_file, args) => {
      if (args[0] === "version") return ok("go version go1.24.0 darwin/arm64\n");
      if (args[0] === "env" && args[1] === "-json") return ok("{}");
      if (args[0] === "env") {
        return ok('GOROOT="/opt/go"\nGOOS="darwin"\nGOARCH="arm64"\n');
      }
      return fail(1);
    };
    const report = await detectGoEnvironment({
      resolveExecutable: () => "/opt/go/bin/go",
      runCommand,
    });
    assert.equal(report.status, "ready");
    assert.equal(report.goroot, "/opt/go");
    assert.equal(report.goos, "darwin");
  });

  it("rejects invalid minimum version input", async () => {
    const report = await detectGoEnvironment({
      minimumVersion: "abc",
      resolveExecutable: () => "/usr/bin/go",
      runCommand: async () => ok("go version go1.24.0 linux/amd64\n"),
    });
    assert.equal(report.status, "error");
    assert.match(report.message, /Invalid minimum Go version/i);
  });
});

describe("resolveGoExecutable", () => {
  const tempDirs: string[] = [];
  after(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds a go binary on PATH (posix-style name)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-go-path-"));
    tempDirs.push(dir);
    const bin = path.join(dir, process.platform === "win32" ? "go.exe" : "go");
    fs.writeFileSync(bin, "#!/bin/sh\necho stub\n");
    if (process.platform !== "win32") {
      fs.chmodSync(bin, 0o755);
    }

    const previousPath = process.env.PATH;
    process.env.PATH = `${dir}${path.delimiter}${previousPath ?? ""}`;
    try {
      const resolved = resolveGoExecutable();
      assert.equal(resolved, bin);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("returns undefined when PATH has no go binary", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-go-empty-"));
    tempDirs.push(dir);
    const previousPath = process.env.PATH;
    process.env.PATH = dir;
    try {
      assert.equal(resolveGoExecutable(), undefined);
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
