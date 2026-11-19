/**
 * Minimal, formatting-preserving editor for the parts of `pyproject.toml` the kit
 * owns: `[project] name`, `[project] dependencies` and `[dependency-groups] dev`.
 * Everything else in the file (comments, tool tables, ordering) is left byte-for-byte.
 */

export type PythonRequirement = { name: string; spec: string };

/** PEP 503 normalization used to compare distribution names. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** Split a PEP 508 requirement (`uvicorn[standard]>=0.30`) into its name and the rest. */
export function parseRequirement(requirement: string): PythonRequirement {
  const match = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(.*)$/.exec(requirement);
  return { name: match?.[1] ?? requirement, spec: (match?.[2] ?? "").trim() };
}

export function formatRequirement(name: string, spec: string): string {
  return `${name}${spec}`;
}

function sectionRange(lines: string[], header: string): { start: number; end: number } | undefined {
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function keyRange(
  lines: string[],
  section: { start: number; end: number },
  key: string,
): { from: number; to: number } | undefined {
  const pattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`);
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (!pattern.test(lines[i] ?? "")) continue;
    // Single-line array or a multi-line array closed by a line starting with `]`.
    let to = i;
    if (!/\]\s*(#.*)?$/.test(lines[i] ?? "")) {
      while (to + 1 < section.end && !/^\s*\]/.test(lines[to + 1] ?? "")) to += 1;
      to += 1;
    }
    return { from: i, to: Math.min(to, section.end - 1) };
  }
  return undefined;
}

function stringsIn(text: string): string[] {
  return [...text.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "");
}

export function readStringArray(source: string, header: string, key: string): string[] {
  const lines = source.split("\n");
  const section = sectionRange(lines, header);
  if (!section) return [];
  const range = keyRange(lines, section, key);
  if (!range) return [];
  const text = lines.slice(range.from, range.to + 1).join("\n");
  return stringsIn(text.slice(text.indexOf("=") + 1));
}

function renderArray(key: string, values: string[]): string[] {
  return [`${key} = [`, ...values.map((value) => `  ${JSON.stringify(value)},`), "]"];
}

/** Replace (or add) `key = [...]` in a section, preserving the rest of the file. */
export function writeStringArray(
  source: string,
  header: string,
  key: string,
  values: string[],
): string {
  const lines = source.split("\n");
  const section = sectionRange(lines, header);
  if (!section) {
    const body = [header, ...renderArray(key, values)];
    return `${source.replace(/\n*$/, "\n")}\n${body.join("\n")}\n`;
  }
  const range = keyRange(lines, section, key);
  const rendered = renderArray(key, values);
  if (range) {
    lines.splice(range.from, range.to - range.from + 1, ...rendered);
  } else {
    lines.splice(section.start + 1, 0, ...rendered);
  }
  return lines.join("\n");
}

/** Merge requirements by normalized name: new/changed ones replace, others are kept in order. */
export function mergeRequirements(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  for (const requirement of incoming) {
    const { name } = parseRequirement(requirement);
    const index = out.findIndex(
      (item) => normalizeName(parseRequirement(item).name) === normalizeName(name),
    );
    if (index === -1) out.push(requirement);
    else out[index] = requirement;
  }
  return out;
}

export function setProjectName(source: string, name: string): string {
  const lines = source.split("\n");
  const section = sectionRange(lines, "[project]");
  if (!section) return source;
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (/^\s*name\s*=/.test(lines[i] ?? "")) {
      lines[i] = `name = ${JSON.stringify(name)}`;
      return lines.join("\n");
    }
  }
  lines.splice(section.start + 1, 0, `name = ${JSON.stringify(name)}`);
  return lines.join("\n");
}

export function readProjectName(source: string): string | undefined {
  const lines = source.split("\n");
  const section = sectionRange(lines, "[project]");
  if (!section) return undefined;
  for (let i = section.start + 1; i < section.end; i += 1) {
    const match = /^\s*name\s*=\s*"([^"]*)"/.exec(lines[i] ?? "");
    if (match) return match[1];
  }
  return undefined;
}

export const DEPENDENCIES = { header: "[project]", key: "dependencies" } as const;
export const DEV_GROUP = { header: "[dependency-groups]", key: "dev" } as const;
