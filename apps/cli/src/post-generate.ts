import { spawnSync } from "node:child_process";

export type GitResult = { git: "ok" | "skipped" | "failed"; message?: string };

function git(args: string[], cwd: string) {
  return spawnSync("git", args, { cwd, encoding: "utf-8", windowsHide: true });
}

/**
 * `git init` + first commit. Never throws: a missing git, an enclosing
 * repository, or a missing identity is reported, not fatal.
 */
export function initGitRepository(targetDir: string): GitResult {
  const probe = git(["rev-parse", "--is-inside-work-tree"], targetDir);
  if (probe.error) {
    return { git: "skipped", message: "git is not installed." };
  }
  if (probe.status === 0 && probe.stdout.trim() === "true") {
    return { git: "skipped", message: "already inside a git work tree." };
  }

  const init = git(["init", "-q"], targetDir);
  if (init.status !== 0) {
    return { git: "failed", message: init.stderr.trim() || "git init failed." };
  }
  const add = git(["add", "-A"], targetDir);
  const commit =
    add.status === 0 ? git(["commit", "-q", "-m", "Initial commit from zealakit"], targetDir) : add;
  if (commit.status !== 0) {
    return {
      git: "failed",
      message: `repository created, but the initial commit failed: ${commit.stderr.trim() || "unknown error"}`,
    };
  }
  return { git: "ok" };
}
