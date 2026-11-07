import { resolveGoExecutable } from "./resolve-executable.js";
import { defaultRunCommand } from "./run-command.js";
import type {
  DetectGoEnvironmentOptions,
  GoEnvironmentIssue,
  GoEnvironmentReport,
  RunCommand,
} from "./types.js";
import {
  extractGoVersionLabel,
  formatGoSemVer,
  parseGoVersion,
  satisfiesMinimumGoVersion,
} from "./version.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const INSTALL_URL = "https://go.dev/doc/install";

function report(
  partial: Omit<GoEnvironmentReport, "issues"> & { issues?: GoEnvironmentIssue[] },
): GoEnvironmentReport {
  return { issues: [], ...partial };
}

function parseGoEnvJson(stdout: string): Record<string, string> {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Fallback parser for `go env` key=value lines (and `KEY="value"`). */
function parseGoEnvLines(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function readGoEnv(
  goBin: string,
  runCommand: RunCommand,
  timeoutMs: number,
): Promise<{ env: Record<string, string>; issues: GoEnvironmentIssue[] }> {
  const issues: GoEnvironmentIssue[] = [];
  const jsonResult = await runCommand(goBin, ["env", "-json"], { timeoutMs });
  if (!jsonResult.spawnError && !jsonResult.timedOut && jsonResult.exitCode === 0) {
    const env = parseGoEnvJson(jsonResult.stdout);
    if (Object.keys(env).length > 0) {
      return { env, issues };
    }
    issues.push({
      code: "go-env-json-empty",
      message: "`go env -json` succeeded but produced no usable keys; falling back to text output.",
    });
  }

  const textResult = await runCommand(goBin, ["env"], { timeoutMs });
  if (textResult.spawnError || textResult.timedOut || textResult.exitCode !== 0) {
    issues.push({
      code: "go-env-failed",
      message: textResult.timedOut
        ? "`go env` timed out."
        : `\`go env\` failed (exit ${textResult.exitCode}).`,
    });
    return { env: {}, issues };
  }

  return { env: parseGoEnvLines(textResult.stdout), issues };
}

/**
 * Detect whether a usable Go toolchain is available.
 * Does not modify the environment and never installs Go.
 */
export async function detectGoEnvironment(
  options: DetectGoEnvironmentOptions = {},
): Promise<GoEnvironmentReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runCommand = options.runCommand ?? defaultRunCommand;
  const resolveExecutable = options.resolveExecutable ?? resolveGoExecutable;
  const minimumVersion = options.minimumVersion?.trim() || undefined;

  if (minimumVersion && !parseGoVersion(minimumVersion)) {
    return report({
      available: false,
      status: "error",
      minimumVersion,
      message: `Invalid minimum Go version '${minimumVersion}'. Use a value like 1.22.0.`,
      issues: [{ code: "invalid-minimum-version", message: `Cannot parse '${minimumVersion}'.` }],
    });
  }

  const executablePath = resolveExecutable();
  if (!executablePath) {
    return report({
      available: false,
      status: "missing",
      minimumVersion,
      message: `Go is not installed or cannot be found in PATH.\n\nInstall Go:\n${INSTALL_URL}\n\nYour existing TypeScript templates and recipes can still be used.`,
      issues: [{ code: "go-not-on-path", message: "No `go` executable found on PATH." }],
    });
  }

  const versionResult = await runCommand(executablePath, ["version"], { timeoutMs });

  if (versionResult.spawnError?.code === "ENOENT") {
    return report({
      available: false,
      status: "missing",
      executablePath,
      minimumVersion,
      message: `Go is not installed or cannot be found in PATH.\n\nInstall Go:\n${INSTALL_URL}\n\nYour existing TypeScript templates and recipes can still be used.`,
      issues: [{ code: "go-enoent", message: `Failed to execute '${executablePath}' (ENOENT).` }],
    });
  }

  if (versionResult.timedOut) {
    return report({
      available: false,
      status: "error",
      executablePath,
      minimumVersion,
      message: `Go environment detection timed out while running \`go version\` (${timeoutMs}ms).`,
      issues: [{ code: "go-version-timeout", message: "`go version` timed out." }],
    });
  }

  if (versionResult.spawnError || versionResult.exitCode !== 0) {
    const detail =
      versionResult.stderr.trim() ||
      versionResult.stdout.trim() ||
      versionResult.spawnError?.message ||
      `exit ${versionResult.exitCode}`;
    return report({
      available: false,
      status: "error",
      executablePath,
      minimumVersion,
      message: `Go executable was found but \`go version\` failed: ${detail}`,
      issues: [{ code: "go-version-failed", message: detail }],
    });
  }

  const versionLabel = extractGoVersionLabel(versionResult.stdout);
  const parsed = versionLabel ? parseGoVersion(versionLabel) : undefined;
  if (!versionLabel || !parsed) {
    return report({
      available: false,
      status: "error",
      executablePath,
      minimumVersion,
      message: `Could not parse Go version from output: ${versionResult.stdout.trim() || "(empty)"}`,
      issues: [
        {
          code: "go-version-malformed",
          message: `Unexpected \`go version\` output: ${JSON.stringify(versionResult.stdout.trim())}`,
        },
      ],
    });
  }

  const version = formatGoSemVer(parsed);
  const { env, issues: envIssues } = await readGoEnv(executablePath, runCommand, timeoutMs);

  const base = {
    available: true as const,
    version,
    versionLabel,
    minimumVersion,
    executablePath,
    goroot: env.GOROOT || undefined,
    gopath: env.GOPATH || undefined,
    gomodcache: env.GOMODCACHE || undefined,
    goos: env.GOOS || undefined,
    goarch: env.GOARCH || undefined,
  };

  if (minimumVersion && !satisfiesMinimumGoVersion(version, minimumVersion)) {
    return report({
      ...base,
      status: "incompatible",
      message: `Go ${versionLabel} is installed but does not satisfy the required minimum ${minimumVersion}.`,
      issues: [
        ...envIssues,
        {
          code: "go-version-too-low",
          message: `Installed ${versionLabel}; required >= ${minimumVersion}.`,
        },
      ],
    });
  }

  return report({
    ...base,
    status: "ready",
    message: minimumVersion
      ? `Go environment is ready (${versionLabel}, satisfies >= ${minimumVersion}).`
      : "Go environment is ready.",
    issues: envIssues,
  });
}
