import fs from "node:fs";
import path from "node:path";
import { fse } from "../fs-extra.js";
import {
  assertStagingRealPath,
  getRecipeDir,
  RECIPE_SCAFFOLD_DIR,
  resolveStagingPath,
} from "./paths.js";

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

/** Read the kit-owned recipe entry (intentional read outside the staging dir). */
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
    const filePath = resolveStagingPath(targetDir, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    assertStagingRealPath(targetDir, filePath);
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
  const agentsDir = resolveStagingPath(targetDir, ".agents");
  const cursorPath = resolveStagingPath(targetDir, ".cursor");
  if (!fs.existsSync(agentsDir)) {
    return;
  }
  // The link target must stay inside staging even if `.agents` is a symlink.
  assertStagingRealPath(targetDir, agentsDir);
  if (!fs.statSync(agentsDir).isDirectory()) {
    throw new Error("Agent docs path '.agents' must be a directory (found a file).");
  }

  try {
    const cursorStat = fs.lstatSync(cursorPath);
    if (cursorStat.isSymbolicLink() && fs.readlinkSync(cursorPath) === ".agents") {
      return;
    }
    // `.cursor` is a compatibility link, not generated content: replace a copied
    // directory/file or a wrong symlink. Removing a symlink only drops the link,
    // never its external target, and staging remains recoverable until commit.
    fse.removeSync(cursorPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    // "dir" is required for directory symlinks on Windows; ignored on POSIX.
    fs.symlinkSync(".agents", cursorPath, "dir");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform === "win32" && (code === "EPERM" || code === "EACCES")) {
      throw new Error(
        "Could not create the '.cursor' directory symlink. On Windows, enable Developer Mode or grant symlink privileges, then retry.",
        { cause: error },
      );
    }
    throw error;
  }
}
