import fs from "node:fs";
import path from "node:path";

export function directoryHasFiles(targetDir: string): boolean {
  return fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0;
}

/** Whether the destination can be written without replacing existing files. */
export type TargetDirectoryCheck = {
  status: "empty" | "non-empty";
  /** Absolute destination path. */
  path: string;
};

/** Pure inspection of the destination. Prompting for overwrite is the caller's job. */
export function checkTargetDirectory(projectName: string, cwd: string): TargetDirectoryCheck {
  const resolved = path.resolve(cwd, projectName);
  return { status: directoryHasFiles(resolved) ? "non-empty" : "empty", path: resolved };
}

/** What to do when the destination already contains files. */
export type OverwritePolicy = "refuse" | "allow";

export function nonEmptyTargetMessage(projectName: string): string {
  return `Directory "${projectName}" already exists and is not empty. Choose a different name or allow overwrite explicitly.`;
}
