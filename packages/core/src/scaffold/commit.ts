import fs from "node:fs";
import path from "node:path";
import { fse } from "../fs-extra.js";

/**
 * Filesystem operations used by the commit step.
 *
 * Exposed (with a default implementation) so failure scenarios—move/rollback/
 * cleanup errors—can be exercised without mocking `node:fs` globally.
 */
export type CommitFileSystem = {
  existsSync: (target: string) => boolean;
  lstatSync: (target: string) => fs.Stats;
  ensureDirSync: (dir: string) => void;
  makeTempDirSync: (parentDir: string, prefix: string) => string;
  copySync: (source: string, destination: string) => void;
  renameSync: (source: string, destination: string) => void;
  removeSync: (target: string) => void;
};

export const defaultCommitFileSystem: CommitFileSystem = {
  existsSync: (target) => fs.existsSync(target),
  lstatSync: (target) => fs.lstatSync(target),
  ensureDirSync: (dir) => fse.ensureDirSync(dir),
  makeTempDirSync: (parentDir, prefix) => fs.mkdtempSync(path.join(parentDir, prefix)),
  copySync: (source, destination) =>
    fse.copySync(source, destination, { overwrite: true, errorOnExist: false }),
  renameSync: (source, destination) => fs.renameSync(source, destination),
  removeSync: (target) => fse.removeSync(target),
};

export type ScaffoldCommitErrorDetails = {
  targetDir: string;
  /** Prepared replacement directory, when one was created. */
  commitDir?: string;
  /** Previous target contents, when they were moved aside. */
  backupDir?: string;
  /** Present when rollback failed; the backup is intentionally preserved. */
  rollbackError?: Error;
};

/**
 * Commit failure that keeps enough paths/errors to recover manually.
 * `cause` is the original filesystem error; `rollbackError` is separate so both
 * failures stay distinguishable.
 */
export class ScaffoldCommitError extends Error {
  readonly targetDir: string;
  readonly commitDir?: string;
  readonly backupDir?: string;
  readonly rollbackError?: Error;

  constructor(message: string, details: ScaffoldCommitErrorDetails, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ScaffoldCommitError";
    this.targetDir = details.targetDir;
    if (details.commitDir !== undefined) this.commitDir = details.commitDir;
    if (details.backupDir !== undefined) this.backupDir = details.backupDir;
    if (details.rollbackError !== undefined) this.rollbackError = details.rollbackError;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** Cleanup must never mask the original commit failure. */
function safeRemove(target: string, ops: CommitFileSystem): void {
  try {
    ops.removeSync(target);
  } catch {
    // Best-effort: the caller keeps the original error, and backups are never
    // removed on failure paths.
  }
}

function createBackupPath(targetDir: string, ops: CommitFileSystem): string {
  const parentDir = path.dirname(targetDir);
  const base = path.basename(targetDir);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = path.join(
      parentDir,
      `.${base}.zealakit-backup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    );
    if (!ops.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new ScaffoldCommitError(
    `Could not allocate a backup path beside '${targetDir}'. Remove stale '.zealakit-backup-*' directories and retry.`,
    { targetDir },
  );
}

function createCommitDir(targetDir: string, ops: CommitFileSystem): string {
  const parentDir = path.dirname(targetDir);
  const base = path.basename(targetDir);
  try {
    return ops.makeTempDirSync(parentDir, `.${base}.zealakit-commit-`);
  } catch (error) {
    throw new ScaffoldCommitError(
      `Failed to create a commit directory beside '${targetDir}': ${describeError(error)}`,
      { targetDir },
      error,
    );
  }
}

/** Copy the staging output next to the target (same filesystem for the final rename). */
function prepareCommitDir(stageDir: string, targetDir: string, ops: CommitFileSystem): string {
  const commitDir = createCommitDir(targetDir, ops);
  try {
    ops.copySync(stageDir, commitDir);
    return commitDir;
  } catch (error) {
    safeRemove(commitDir, ops);
    throw new ScaffoldCommitError(
      `Failed to prepare the generated project beside '${targetDir}': ${describeError(error)}`,
      { targetDir, commitDir },
      error,
    );
  }
}

/**
 * Commit a fully generated + validated staging directory into `targetDir`.
 *
 * - New target: atomic rename when the staging dir is on the same filesystem;
 *   otherwise copy beside the target and rename into place.
 * - Existing target (empty or not): prepare a sibling replacement, move the old
 *   target to a backup, rename the replacement into place, then drop the backup.
 *   On any failure the backup is restored when possible.
 *
 * Guarantees: the existing target is never emptied before a full replacement is
 * ready. When the filesystem rejects the rename (permissions, open handles,
 * platform restrictions), the original target stays untouched or is restored.
 * Full atomicity is not claimed for cross-device staging; that path copies first.
 */
export function commitStagedDirectory(
  stageDir: string,
  targetDir: string,
  ops: CommitFileSystem = defaultCommitFileSystem,
): void {
  try {
    ops.ensureDirSync(path.dirname(targetDir));
  } catch (error) {
    throw new ScaffoldCommitError(
      `Failed to prepare the parent directory for '${targetDir}': ${describeError(error)}`,
      { targetDir },
      error,
    );
  }

  if (!ops.existsSync(targetDir)) {
    commitIntoNewTarget(stageDir, targetDir, ops);
    return;
  }

  if (!ops.lstatSync(targetDir).isDirectory()) {
    throw new ScaffoldCommitError(
      `Cannot commit into '${targetDir}': the path exists and is not a directory. Move it aside and retry.`,
      { targetDir },
    );
  }

  commitReplacingTarget(stageDir, targetDir, ops);
}

function commitIntoNewTarget(stageDir: string, targetDir: string, ops: CommitFileSystem): void {
  try {
    ops.renameSync(stageDir, targetDir);
    return;
  } catch (error) {
    if (errorCode(error) !== "EXDEV") {
      throw new ScaffoldCommitError(
        `Failed to move the generated project into '${targetDir}': ${describeError(error)}`,
        { targetDir },
        error,
      );
    }
  }

  // Staging lives on another filesystem: prepare beside the target, then rename.
  const commitDir = prepareCommitDir(stageDir, targetDir, ops);
  try {
    ops.renameSync(commitDir, targetDir);
  } catch (error) {
    safeRemove(commitDir, ops);
    throw new ScaffoldCommitError(
      `Failed to move the generated project into '${targetDir}': ${describeError(error)}`,
      { targetDir, commitDir },
      error,
    );
  }
  safeRemove(stageDir, ops);
}

function commitReplacingTarget(stageDir: string, targetDir: string, ops: CommitFileSystem): void {
  // Allocate the backup path first: if the prepared directory cannot be
  // created, nothing has been moved and no directory leaks.
  const backupDir = createBackupPath(targetDir, ops);
  const commitDir = prepareCommitDir(stageDir, targetDir, ops);

  try {
    ops.renameSync(targetDir, backupDir);
  } catch (error) {
    safeRemove(commitDir, ops);
    throw new ScaffoldCommitError(
      `Failed to move the existing project at '${targetDir}' aside before commit: ${describeError(error)}`,
      { targetDir, commitDir },
      error,
    );
  }

  try {
    ops.renameSync(commitDir, targetDir);
  } catch (commitError) {
    try {
      ops.renameSync(backupDir, targetDir);
    } catch (rollbackError) {
      // Keep both the backup and the generated output for manual recovery.
      throw new ScaffoldCommitError(
        [
          `Failed to commit the generated project into '${targetDir}': ${describeError(commitError)}`,
          `Rollback also failed: ${describeError(rollbackError)}`,
          `Your previous contents are preserved at '${backupDir}'.`,
          `The generated files remain at '${commitDir}'.`,
          "Restore the backup manually after resolving the filesystem issue, then retry.",
        ].join("\n"),
        {
          targetDir,
          commitDir,
          backupDir,
          rollbackError:
            rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)),
        },
        commitError,
      );
    }

    safeRemove(commitDir, ops);
    throw new ScaffoldCommitError(
      `Failed to commit the generated project into '${targetDir}': ${describeError(commitError)}. The previous contents were restored.`,
      { targetDir },
      commitError,
    );
  }

  // Commit succeeded: the backup and staging dir are now safe to remove.
  safeRemove(backupDir, ops);
  safeRemove(stageDir, ops);
}
