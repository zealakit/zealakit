import fs from "node:fs";
import path from "node:path";

/**
 * Dead-export check for `@zealakit/core/internal`.
 *
 * Every name re-exported from `packages/core/src/internal.ts` must be imported
 * by something outside core (CLI, ecosystems, tests, scripts, monitor).
 * `pnpm check:exports` fails on dead names; `pnpm check:exports --fix` prunes them.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const INTERNAL = path.join(ROOT, "packages/core/src/internal.ts");
const CONSUMER_DIRS = [
  "apps",
  "packages/ecosystem-node",
  "packages/ecosystem-go",
  "tests",
  "scripts",
  "monitor",
];
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@zealakit\/core\/internal"/g;
const EXPORT_RE = /export\s+(type\s+)?\{([^}]*)\}\s+from\s+"[^"]+";\n/g;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") && full !== path.join(ROOT, "scripts/check-exports.ts"))
      out.push(full);
  }
  return out;
}

function importedNames(): Set<string> {
  const used = new Set<string>();
  for (const dir of CONSUMER_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const source = fs.readFileSync(file, "utf-8");
      for (const match of source.matchAll(IMPORT_RE)) {
        for (const raw of (match[1] ?? "").split(",")) {
          const name = raw
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0];
          if (name) used.add(name);
        }
      }
    }
  }
  return used;
}

function specifierName(raw: string): string {
  return raw
    .trim()
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/)
    .pop() as string;
}

const used = importedNames();
const source = fs.readFileSync(INTERNAL, "utf-8");
const dead: string[] = [];

const pruned = source.replace(
  EXPORT_RE,
  (statement, typeOnly: string | undefined, body: string) => {
    const specifiers = body
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const keep = specifiers.filter((item) => {
      const name = specifierName(item);
      if (used.has(name)) return true;
      dead.push(name);
      return false;
    });
    if (keep.length === specifiers.length) return statement;
    if (keep.length === 0) return "";
    const from = /from\s+("[^"]+");/.exec(statement)?.[1] ?? "";
    return `export ${typeOnly ?? ""}{\n  ${keep.join(",\n  ")},\n} from ${from};\n`;
  },
);

if (process.argv.includes("--fix")) {
  fs.writeFileSync(INTERNAL, pruned);
  console.log(`Pruned ${dead.length} dead export(s) from internal.ts.`);
} else if (dead.length > 0) {
  console.error(`Dead exports in packages/core/src/internal.ts (${dead.length}):`);
  for (const name of dead.sort()) console.error(`  - ${name}`);
  console.error("Run `pnpm check:exports --fix` to prune them.");
  process.exit(1);
} else {
  console.log("No dead exports in @zealakit/core/internal.");
}
