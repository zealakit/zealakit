/** Shared status vocabulary for optional toolchain checks (Go today; others later). */
export type ToolchainStatus = "ready" | "missing" | "incompatible" | "error";

export type GoEnvironmentIssue = {
  code: string;
  message: string;
};

export type GoEnvironmentReport = {
  available: boolean;
  status: ToolchainStatus;
  /** Normalized semver-like string without the `go` prefix, e.g. `1.25.1`. */
  version?: string;
  /** Raw version token from `go version`, e.g. `go1.25.1`. */
  versionLabel?: string;
  /** Minimum version that was checked, when the caller requested one. */
  minimumVersion?: string;
  goroot?: string;
  gopath?: string;
  gomodcache?: string;
  goos?: string;
  goarch?: string;
  executablePath?: string;
  message: string;
  issues: GoEnvironmentIssue[];
};

export type DetectGoEnvironmentOptions = {
  /** When set, versions below this mark status `incompatible`. */
  minimumVersion?: string;
  /** Override command runner (tests). Defaults to a timed `spawn` of argv. */
  runCommand?: RunCommand;
  /** Override PATH lookup for the `go` binary (tests). */
  resolveExecutable?: () => string | undefined;
  /** Max ms for each external Go command. Default 5000. */
  timeoutMs?: number;
};

export type RunCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Set when the process could not be started (e.g. ENOENT). */
  spawnError?: NodeJS.ErrnoException;
  timedOut?: boolean;
};

export type RunCommand = (
  file: string,
  args: readonly string[],
  options?: { timeoutMs?: number },
) => Promise<RunCommandResult>;
