import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { scaffoldProject } from "@zealakit/core";
import {
  type CommitFileSystem,
  commitStagedDirectory,
  defaultCommitFileSystem,
  ScaffoldCommitError,
} from "../../packages/core/src/scaffold/commit.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-commit-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

function freshDir(prefix = "case"): string {
  const dir = path.join(workRoot, `${prefix}-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(dir: string, relativePath: string, content: string): void {
  const target = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function readFile(dir: string, relativePath: string): string {
  return fs.readFileSync(path.join(dir, relativePath), "utf-8");
}

function createStage(files: Record<string, string> = { "src/main.ts": "generated" }): string {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-stage-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(stage, relativePath, content);
  }
  return stage;
}

function cleanupStage(stage: string): void {
  fs.rmSync(stage, { recursive: true, force: true });
}

/** Temporary siblings the commit step may leave beside the target. */
function commitSiblings(targetDir: string): string[] {
  return fs
    .readdirSync(path.dirname(targetDir))
    .filter((name) => name.includes(".zealakit-commit-") || name.includes(".zealakit-backup-"));
}

function withFailingOps(overrides: Partial<CommitFileSystem>): CommitFileSystem {
  return { ...defaultCommitFileSystem, ...overrides };
}

function captureCommitError(run: () => void): ScaffoldCommitError {
  try {
    run();
  } catch (error) {
    assert.ok(
      error instanceof ScaffoldCommitError,
      `expected ScaffoldCommitError, got ${String(error)}`,
    );
    return error;
  }
  assert.fail("expected commit to throw");
}

describe("commit success", () => {
  it("commits into a new target directory and removes the staging dir", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    const unrelated = path.join(parent, "unrelated");
    fs.mkdirSync(unrelated);
    const stage = createStage();

    commitStagedDirectory(stage, target);

    assert.equal(readFile(target, "src/main.ts"), "generated");
    assert.equal(fs.existsSync(stage), false);
    assert.deepEqual(commitSiblings(target), []);
    assert.equal(fs.existsSync(unrelated), true, "unrelated directories must survive cleanup");
  });

  it("commits into an existing empty target directory", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    fs.mkdirSync(target);
    const stage = createStage({ "package.json": "{}", ".agents/rules.md": "rules" });

    commitStagedDirectory(stage, target);

    assert.equal(readFile(target, "package.json"), "{}");
    assert.equal(readFile(target, ".agents/rules.md"), "rules");
    assert.equal(fs.existsSync(stage), false);
    assert.deepEqual(commitSiblings(target), []);
  });

  it("replaces an existing non-empty target directory and drops the backup", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "old/notes.txt", "user data");
    writeFile(target, "stale.js", "old");
    const stage = createStage();

    commitStagedDirectory(stage, target);

    assert.equal(readFile(target, "src/main.ts"), "generated");
    assert.equal(fs.existsSync(path.join(target, "stale.js")), false);
    assert.equal(fs.existsSync(path.join(target, "old/notes.txt")), false);
    assert.equal(fs.existsSync(stage), false);
    assert.deepEqual(commitSiblings(target), []);
  });

  it("falls back to a sibling copy when staging is on another filesystem (EXDEV)", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    const stage = createStage();
    const ops = withFailingOps({
      renameSync: (source, destination) => {
        if (source === stage) {
          throw Object.assign(new Error("EXDEV: cross-device link not permitted"), {
            code: "EXDEV",
          });
        }
        defaultCommitFileSystem.renameSync(source, destination);
      },
    });

    commitStagedDirectory(stage, target, ops);

    assert.equal(readFile(target, "src/main.ts"), "generated");
    assert.equal(fs.existsSync(stage), false);
    assert.deepEqual(commitSiblings(target), []);
  });

  it("refuses a target path that exists and is not a directory", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    fs.writeFileSync(target, "not a directory", "utf-8");
    const stage = createStage();

    const error = captureCommitError(() => commitStagedDirectory(stage, target));
    assert.match(error.message, /not a directory/);
    assert.equal(fs.readFileSync(target, "utf-8"), "not a directory");
    cleanupStage(stage);
  });
});

describe("commit failure and rollback", () => {
  it("keeps the existing target intact when preparing the replacement fails", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "keep.txt", "user data");
    const stage = createStage();
    const ops = withFailingOps({
      copySync: () => {
        throw new Error("simulated copy failure");
      },
    });

    const error = captureCommitError(() => commitStagedDirectory(stage, target, ops));
    assert.match(error.message, /Failed to prepare the generated project/);
    assert.match(error.message, /simulated copy failure/);
    assert.equal(readFile(target, "keep.txt"), "user data");
    assert.equal(fs.existsSync(stage), true, "staging dir is kept for retry/diagnostics");
    assert.deepEqual(commitSiblings(target), []);
    cleanupStage(stage);
  });

  it("keeps the existing target intact when it cannot be moved aside", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "keep.txt", "user data");
    const stage = createStage();
    const ops = withFailingOps({
      renameSync: (source, destination) => {
        if (source === target) {
          throw new Error("simulated move-aside failure");
        }
        defaultCommitFileSystem.renameSync(source, destination);
      },
    });

    const error = captureCommitError(() => commitStagedDirectory(stage, target, ops));
    assert.match(error.message, /Failed to move the existing project/);
    assert.equal(readFile(target, "keep.txt"), "user data");
    assert.deepEqual(commitSiblings(target), []);
    cleanupStage(stage);
  });

  it("restores the previous target when the final move fails", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "keep.txt", "user data");
    const stage = createStage();
    let movesIntoPlace = 0;
    const ops = withFailingOps({
      renameSync: (source, destination) => {
        if (destination === target) {
          movesIntoPlace += 1;
          if (movesIntoPlace === 1) {
            throw new Error("simulated final move failure");
          }
        }
        defaultCommitFileSystem.renameSync(source, destination);
      },
    });

    const error = captureCommitError(() => commitStagedDirectory(stage, target, ops));
    assert.match(error.message, /previous contents were restored/);
    assert.equal(readFile(target, "keep.txt"), "user data");
    assert.equal(fs.existsSync(path.join(target, "src/main.ts")), false);
    assert.deepEqual(commitSiblings(target), []);
    cleanupStage(stage);
  });

  it("preserves the backup and reports both errors when rollback fails", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "keep.txt", "user data");
    const stage = createStage();
    const ops = withFailingOps({
      renameSync: (source, destination) => {
        if (destination === target) {
          throw new Error("simulated move failure");
        }
        defaultCommitFileSystem.renameSync(source, destination);
      },
    });

    const error = captureCommitError(() => commitStagedDirectory(stage, target, ops));
    const backupDir = error.backupDir;
    const commitDir = error.commitDir;
    try {
      assert.match(error.message, /Rollback also failed/);
      assert.match(error.message, /previous contents are preserved at/);
      assert.ok(backupDir, "backup path must be reported");
      assert.ok(commitDir, "prepared directory must be reported");
      assert.ok(error.rollbackError instanceof Error);
      assert.equal(fs.existsSync(target), false);
      assert.equal(readFile(backupDir, "keep.txt"), "user data");
      assert.equal(readFile(commitDir, "src/main.ts"), "generated");
      assert.ok(error.message.includes(backupDir));
      assert.ok(error.message.includes(commitDir));
    } finally {
      if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });
      if (commitDir) fs.rmSync(commitDir, { recursive: true, force: true });
      cleanupStage(stage);
    }
  });

  it("does not fail the commit when temporary cleanup fails", () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "old.txt", "old");
    const stage = createStage();
    const ops = withFailingOps({
      removeSync: () => {
        throw new Error("simulated cleanup failure");
      },
    });

    try {
      commitStagedDirectory(stage, target, ops);
      assert.equal(readFile(target, "src/main.ts"), "generated");
      const leftovers = commitSiblings(target);
      assert.ok(
        leftovers.some((name) => name.includes(".zealakit-backup-")),
        "backup is preserved when its cleanup fails",
      );
      assert.equal(fs.existsSync(stage), true, "staging dir is preserved when cleanup fails");
    } finally {
      cleanupStage(stage);
      for (const name of commitSiblings(target)) {
        fs.rmSync(path.join(path.dirname(target), name), { recursive: true, force: true });
      }
    }
  });

  it("reports permission errors without modifying the existing target", {
    skip:
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0),
  }, () => {
    const parent = freshDir();
    const target = path.join(parent, "app");
    writeFile(target, "keep.txt", "user data");
    const stage = createStage();
    fs.chmodSync(parent, 0o500);
    try {
      const error = captureCommitError(() => commitStagedDirectory(stage, target));
      assert.match(error.message, /Failed to create a commit directory|EACCES|permission/i);
      assert.equal(readFile(target, "keep.txt"), "user data");
    } finally {
      fs.chmodSync(parent, 0o700);
      cleanupStage(stage);
    }
  });
});

describe("scaffoldProject commit integration", () => {
  it("replaces an existing non-empty directory through the full pipeline", async () => {
    const cwd = freshDir("project");
    const target = path.join(cwd, "app");
    writeFile(target, "stale.js", "old");
    writeFile(target, "notes/keep.txt", "user data");

    const result = await scaffoldProject(
      { projectName: "app", templateId: "vite-react", recipeIds: [] },
      cwd,
    );

    assert.equal(result, target);
    assert.equal(fs.existsSync(path.join(target, "package.json")), true);
    assert.equal(fs.existsSync(path.join(target, "stale.js")), false);
    assert.deepEqual(commitSiblings(target), []);
  });
});
