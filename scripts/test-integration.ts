import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * External-consumer integration test.
 *
 * Builds the real CLI, packs it, installs the tarball into a temporary copy of
 * `tests/integration/external-consumer`, and runs that consumer with only the
 * installed executable. The temporary directory is outside the workspace.
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function noColorEnv(): NodeJS.ProcessEnv {
  const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...env } = process.env;
  return { ...env, NO_COLOR: "1" };
}
const FIXTURE_DIR = path.join(PROJECT_ROOT, "tests/integration/external-consumer");
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-integration-"));
const CONSUMER_DIR = path.join(WORK_DIR, "consumer");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

type RunResult = { status: number | null; stdout: string; stderr: string };

function run(command: string, args: string[], cwd: string, quiet = false): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: noColorEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!quiet) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (!quiet) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function runOrThrow(
  command: string,
  args: string[],
  cwd: string,
  quiet = false,
): Promise<RunResult> {
  const result = await run(command, args, cwd, quiet);
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} ${args.join(" ")} failed (exit ${result.status})`);
  }
  return result;
}

/** Build and pack the published CLI into the temporary work directory. */
async function packCli(): Promise<string> {
  console.log("→ Building CLI...");
  await runOrThrow(PNPM, ["run", "build"], PROJECT_ROOT);

  console.log("→ Packing CLI...");
  const packed = await runOrThrow(
    PNPM,
    ["pack", "--pack-destination", WORK_DIR],
    PROJECT_ROOT,
    true,
  );
  const tarball = packed.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".tgz"))
    .pop();
  if (!tarball) {
    throw new Error(`Could not find packed tarball in pnpm output:\n${packed.stdout}`);
  }
  return path.resolve(WORK_DIR, tarball);
}

function copyFixture(): void {
  fs.cpSync(FIXTURE_DIR, CONSUMER_DIR, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(FIXTURE_DIR, source);
      if (relative === "") return true;
      const segments = relative.split(path.sep);
      return (
        !segments.some((segment) =>
          ["node_modules", "apps", ".zealakit-config", ".DS_Store"].includes(segment),
        ) && relative !== "zealakit.tgz"
      );
    },
  });
}

async function main(): Promise<void> {
  let tarball: string | undefined;
  try {
    tarball = await packCli();
    copyFixture();
    fs.copyFileSync(tarball, path.join(CONSUMER_DIR, "zealakit.tgz"));

    console.log("→ Installing tarball into independent consumer...");
    await runOrThrow(
      PNPM,
      ["install", "--ignore-workspace", "--ignore-scripts", "--prefer-offline"],
      CONSUMER_DIR,
    );

    console.log("→ Running external consumer checks...\n");
    const consumer = await run(process.execPath, ["consumer.mjs"], CONSUMER_DIR);
    if (consumer.status !== 0) {
      throw new Error(`external consumer failed (exit ${consumer.status})`);
    }

    console.log("\n✔ External consumer integration passed.");
  } finally {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
    if (tarball && fs.existsSync(tarball)) {
      fs.rmSync(tarball, { force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
