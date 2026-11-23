import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One canonical copy of the `repo-docs` skill lives in `recipes/_shared/`;
 * every docs recipe ships a byte-identical copy so the packed tarball needs no
 * extra lookup and generated projects own their skill. The kit repository also
 * keeps a copy at `.agents/skills/repo-docs/`, with its own `profile.json`.
 *
 *   pnpm sync:skills           copy `_shared` → each target
 *   pnpm sync:skills --check   fail when a committed copy drifted
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "recipes/_shared/repo-docs");

type Target = {
  /** Directory that owns the skill folder. */
  dir: string;
  /** Skill folder relative to `dir`. */
  skillPath: string;
  /** Files owned by the target (not copied from `_shared`). */
  preserve: string[];
};

const TARGETS: Target[] = [
  { dir: ROOT, skillPath: ".agents/skills/repo-docs", preserve: ["profile.json"] },
  {
    dir: path.join(ROOT, "recipes/node/docs"),
    skillPath: ".agents/skills/repo-docs",
    preserve: [],
  },
  {
    dir: path.join(ROOT, "recipes/go/docs-go"),
    skillPath: ".agents/skills/repo-docs",
    preserve: [],
  },
  {
    dir: path.join(ROOT, "recipes/python/docs-python"),
    skillPath: ".agents/skills/repo-docs",
    preserve: [],
  },
];

const IGNORED = new Set([".DS_Store"]);

function listFiles(dir: string, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, base, out);
    } else {
      out.push(path.relative(base, full));
    }
  }
  return out.sort();
}

function readOrUndefined(file: string): Buffer | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
}

function checkTarget(target: Target): string[] {
  const destination = path.join(target.dir, target.skillPath);
  const preserved = new Set(target.preserve);
  const problems: string[] = [];
  const expected = listFiles(SOURCE).filter((relative) => !preserved.has(relative));
  const actual = listFiles(destination).filter((relative) => !preserved.has(relative));

  for (const relative of expected) {
    const want = readOrUndefined(path.join(SOURCE, relative));
    const got = readOrUndefined(path.join(destination, relative));
    if (!got) {
      problems.push(`${relative}: missing`);
    } else if (want && !want.equals(got)) {
      problems.push(`${relative}: differs from recipes/_shared/repo-docs`);
    }
  }
  for (const relative of actual) {
    if (!expected.includes(relative)) {
      problems.push(`${relative}: not in recipes/_shared/repo-docs`);
    }
  }
  for (const relative of preserved) {
    if (!fs.existsSync(path.join(destination, relative))) {
      problems.push(`${relative}: missing (owned by this target)`);
    }
  }
  return problems;
}

function copyTarget(target: Target): void {
  const destination = path.join(target.dir, target.skillPath);
  const kept = new Map<string, Buffer>();
  for (const relative of target.preserve) {
    const file = path.join(destination, relative);
    if (fs.existsSync(file)) kept.set(relative, fs.readFileSync(file));
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(SOURCE, destination, {
    recursive: true,
    filter: (src) => !IGNORED.has(path.basename(src)),
  });
  for (const [relative, content] of kept) {
    fs.writeFileSync(path.join(destination, relative), content);
  }
}

const check = process.argv.includes("--check");
let failed = false;

for (const target of TARGETS) {
  const label = target.dir === ROOT ? ".agents/skills/repo-docs" : path.relative(ROOT, target.dir);
  if (check) {
    const problems = checkTarget(target);
    if (problems.length > 0) {
      failed = true;
      console.error(`✖ ${label}: ${problems.length} drifted file(s)`);
      for (const problem of problems) console.error(`  - ${problem}`);
    } else {
      console.log(`✔ ${label}`);
    }
  } else {
    copyTarget(target);
    console.log(`→ ${label}`);
  }
}

if (check) {
  if (failed) {
    console.error("\nRun `pnpm sync:skills` and commit the result.");
    process.exit(1);
  }
  console.log("Shared skill copies are in sync.");
}
