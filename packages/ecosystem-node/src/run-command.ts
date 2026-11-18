import { spawnSync } from "node:child_process";

export type CommandOutcome = { ok: true; stdout: string } | { ok: false; message: string };

/**
 * Run a command, streaming its output to stderr so stdout stays clean for
 * machine-readable (`--json`) callers. No shell except on Windows `.cmd` shims.
 */
export function runStreaming(file: string, args: string[], cwd: string): CommandOutcome {
  const result = spawnSync(file, args, {
    cwd,
    stdio: ["ignore", 2, 2],
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (result.error) {
    return { ok: false, message: `${file}: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { ok: false, message: `${file} ${args.join(" ")} exited with code ${result.status}` };
  }
  return { ok: true, stdout: "" };
}

/** Run a command and capture stdout (for `<pm> --version`). */
export function runCapture(file: string, args: string[], cwd: string): CommandOutcome {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf-8",
    shell: process.platform === "win32",
    windowsHide: true,
    timeout: 15_000,
  });
  if (result.error || result.status !== 0) {
    return { ok: false, message: result.error?.message ?? `${file} exited with ${result.status}` };
  }
  return { ok: true, stdout: result.stdout.trim() };
}
