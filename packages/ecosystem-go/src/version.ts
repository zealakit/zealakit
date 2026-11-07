export type GoSemVer = {
  major: number;
  minor: number;
  patch: number;
};

const GO_VERSION_RE = /^go?v?(\d+)\.(\d+)(?:\.(\d+))?/i;
const PLAIN_VERSION_RE = /^v?(\d+)\.(\d+)(?:\.(\d+))?/;

/** Parse `go1.25.1`, `1.25.1`, or `v1.25.1` into numeric components. */
export function parseGoVersion(input: string): GoSemVer | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const match = GO_VERSION_RE.exec(trimmed) ?? PLAIN_VERSION_RE.exec(trimmed);
  if (!match) return undefined;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3] ?? "0");
  if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0)) {
    return undefined;
  }
  return { major, minor, patch };
}

/** Extract the `go1.x.y` token from `go version` stdout. */
export function extractGoVersionLabel(versionOutput: string): string | undefined {
  const match = /\bgo(\d+\.\d+(?:\.\d+)?)\b/.exec(versionOutput);
  return match ? `go${match[1]}` : undefined;
}

export function formatGoSemVer(version: GoSemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Compare two Go versions.
 * @returns negative if `a < b`, 0 if equal, positive if `a > b`
 */
export function compareGoVersions(a: GoSemVer, b: GoSemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/** True when `installed` is greater than or equal to `minimum`. */
export function satisfiesMinimumGoVersion(installed: string, minimum: string): boolean {
  const left = parseGoVersion(installed);
  const right = parseGoVersion(minimum);
  if (!left || !right) return false;
  return compareGoVersions(left, right) >= 0;
}
