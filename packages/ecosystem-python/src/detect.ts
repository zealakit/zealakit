import { spawnSync } from "node:child_process";

export type PythonToolStatus = {
  available: boolean;
  version?: string;
  message: string;
};

export type PythonEnvironmentReport = {
  /** `uv` — the supported installer. */
  uv: PythonToolStatus;
  /** Interpreter on PATH (`python3`, falling back to `python`). */
  python: PythonToolStatus;
};

function probe(command: string, args: string[]): PythonToolStatus {
  const result = spawnSync(command, args, { encoding: "utf-8", timeout: 5_000, windowsHide: true });
  if (result.error || result.status !== 0) {
    return { available: false, message: `${command} was not found on PATH.` };
  }
  const version = /(\d+\.\d+(?:\.\d+)?)/.exec(`${result.stdout}${result.stderr}`)?.[1];
  return { available: true, version, message: `${command} ${version ?? ""}`.trim() };
}

/** Look for `uv` and a Python interpreter; never throws. */
export function detectPythonEnvironment(): PythonEnvironmentReport {
  const uv = probe("uv", ["--version"]);
  const python3 = probe("python3", ["--version"]);
  return {
    uv: uv.available
      ? uv
      : { ...uv, message: "uv was not found (install: https://docs.astral.sh/uv/)." },
    python: python3.available ? python3 : probe("python", ["--version"]),
  };
}
