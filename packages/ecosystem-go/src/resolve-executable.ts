import fs from "node:fs";
import path from "node:path";

const isWindows = process.platform === "win32";

function pathEntries(): string[] {
  const raw = process.env.PATH ?? process.env.Path ?? "";
  return raw.split(path.delimiter).filter((entry) => entry.length > 0);
}

function candidateNames(): string[] {
  if (!isWindows) return ["go"];
  const pathext = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean);
  const names = new Set<string>(["go.exe", "go"]);
  for (const ext of pathext) {
    const normalized = ext.startsWith(".") ? ext : `.${ext}`;
    names.add(`go${normalized.toLowerCase()}`);
    names.add(`go${normalized}`);
  }
  return [...names];
}

function isExecutable(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (isWindows) return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve `go` on PATH without spawning a shell (`which` / `where`).
 * Returns `undefined` when not found.
 */
export function resolveGoExecutable(): string | undefined {
  const names = candidateNames();
  for (const dir of pathEntries()) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}
