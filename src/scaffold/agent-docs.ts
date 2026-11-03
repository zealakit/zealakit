import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import { getRecipeDir, RECIPE_SCAFFOLD_DIR } from "./paths.js";

const AGENT_ENTRY_FILES = ["AGENTS.md", "CLAUDE.md"];

/** Insert missing entry lines after the `Structure:` bullet (or `## Always follow`). */
export function insertAgentEntry(raw: string, entry: string): string {
  const lines = entry
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const missing = lines.filter((line) => !raw.includes(line));
  if (missing.length === 0) {
    return raw;
  }

  const block = `${missing.join("\n")}\n`;
  if (/^- \*\*Structure:\*\*[^\n]*\n/m.test(raw)) {
    return raw.replace(/(^- \*\*Structure:\*\*[^\n]*\n)/m, `$1${block}`);
  }
  if (raw.includes("## Always follow")) {
    return raw.replace(/(## Always follow\n\n)/, `$1${block}`);
  }
  return `${raw.trimEnd()}\n\n${block}`;
}

export function getRecipeAgentEntry(recipeId: string): string | undefined {
  const entryPath = path.join(getRecipeDir(recipeId), RECIPE_SCAFFOLD_DIR, "agent-entry.md");
  if (!fs.existsSync(entryPath)) {
    return undefined;
  }
  return fs.readFileSync(entryPath, "utf-8").trim() || undefined;
}

export function applyAgentEntry(recipeId: string, targetDir: string): void {
  const entry = getRecipeAgentEntry(recipeId);
  if (!entry) {
    return;
  }

  for (const file of AGENT_ENTRY_FILES) {
    const filePath = path.join(targetDir, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const next = insertAgentEntry(raw, entry);
    if (next !== raw) {
      fs.writeFileSync(filePath, next, "utf-8");
    }
  }
}

/**
 * Canonical agent docs live in `.agents/`. `.cursor` must be a relative symlink
 * to `.agents` so Cursor IDE and package-agnostic tools both work.
 */
export function ensureCursorAgentsSymlink(targetDir: string): void {
  const agentsDir = path.join(targetDir, ".agents");
  const cursorPath = path.join(targetDir, ".cursor");
  if (!fs.existsSync(agentsDir)) {
    return;
  }

  try {
    const cursorStat = fs.lstatSync(cursorPath);
    if (cursorStat.isSymbolicLink() && fs.readlinkSync(cursorPath) === ".agents") {
      return;
    }
    // Copy may have dereferenced the symlink into a real directory; `.agents` wins.
    fse.removeSync(cursorPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  fs.symlinkSync(".agents", cursorPath);
}
