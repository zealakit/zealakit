import { spawn } from "node:child_process";
import type { RunCommand, RunCommandResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Safe argv-based process runner (no shell). Used for `go version` / `go env`.
 * Inject a custom `RunCommand` in tests instead of stubbing child_process.
 */
export const defaultRunCommand: RunCommand = (file, args, options = {}) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";

    const child = spawn(file, [...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Force-kill if the process ignores SIGTERM (Windows / stuck children).
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 1_000).unref();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const finish = (result: RunCommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({
        exitCode: 1,
        stdout,
        stderr,
        spawnError: error,
        timedOut,
      });
    });

    child.on("close", (code) => {
      finish({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
};
