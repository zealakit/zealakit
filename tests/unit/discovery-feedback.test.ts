import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  buildDiscoverySessionRecord,
  clearDiscoveryFeedbackSessions,
  computeDiscoveryFeedbackStats,
  DISCOVERY_FEEDBACK_MAX_SESSIONS,
  type DiscoverySessionDraft,
  type DiscoverySessionRecord,
  didChangeDiscoveryRecommendations,
  ExitCode,
  formatDiscoveryFeedbackStats,
  isDiscoveryFeedbackEnabled,
  loadDiscoveryFeedbackStore,
  PACKAGE_ROOT,
  parseDiscoveryFeedbackStore,
  recordDiscoverySession,
  saveDiscoveryFeedbackStore,
  setDiscoveryFeedbackEnabled,
  trimDiscoverySessions,
} from "@zealakit/core";

const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

function tempConfigDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-feedback-"));
}

function storeOptions(dir: string, env: NodeJS.ProcessEnv = {}) {
  return {
    storePath: path.join(dir, "discovery-feedback.json"),
    env: { ...env, ZEALAKIT_CONFIG_DIR: dir },
  };
}

function draft(partial: Partial<DiscoverySessionDraft> = {}): DiscoverySessionDraft {
  return {
    startedAtMs: Date.now() - 1200,
    recommendedTemplateIds: ["vite-react", "next"],
    recommendedRecipeIds: ["prisma"],
    selectedTemplateId: "vite-react",
    selectedRecipeIds: ["prisma"],
    changedRecommendations: false,
    hadCompatibleTemplate: true,
    status: "cancelled",
    ...partial,
  };
}

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("discovery feedback store", () => {
  it("creates a session summary without project paths or answers", () => {
    const record = buildDiscoverySessionRecord(draft(), {
      status: "completed",
      generationSucceeded: true,
    });
    assert.equal(record.status, "completed");
    assert.equal(record.generationSucceeded, true);
    assert.equal(record.selectedTemplateId, "vite-react");
    assert.ok((record.durationMs ?? 0) >= 0);
    assert.equal("projectName" in record, false);
    const json = JSON.stringify(record);
    assert.doesNotMatch(json, /\/Users\//);
    assert.doesNotMatch(json, /projectType/);
  });

  it("records successful and failed generation outcomes", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);

    assert.equal(
      recordDiscoverySession(draft(), { status: "completed", generationSucceeded: true }, options),
      true,
    );
    assert.equal(
      recordDiscoverySession(
        draft({ selectedTemplateId: "hono" }),
        { status: "generation_failed", generationSucceeded: false },
        options,
      ),
      true,
    );

    const store = loadDiscoveryFeedbackStore(options);
    assert.equal(store.sessions.length, 2);
    assert.equal(store.sessions[0]?.status, "completed");
    assert.equal(store.sessions[1]?.status, "generation_failed");
  });

  it("records cancellation and recommendation changes", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);

    assert.equal(
      recordDiscoverySession(
        draft({
          status: "cancelled",
          selectedTemplateId: "next",
          changedRecommendations: true,
          selectedRecipeIds: [],
        }),
        {},
        options,
      ),
      true,
    );

    const session = loadDiscoveryFeedbackStore(options).sessions[0];
    assert.equal(session?.status, "cancelled");
    assert.equal(session?.changedRecommendations, true);
    assert.equal(session?.selectedTemplateId, "next");
  });

  it("detects recommendation changes", () => {
    assert.equal(
      didChangeDiscoveryRecommendations({
        recommendedTemplateIds: ["vite-react"],
        selectedTemplateId: "vite-react",
        recommendedRecipeIds: ["prisma"],
        selectedRecipeIds: ["prisma"],
      }),
      false,
    );
    assert.equal(
      didChangeDiscoveryRecommendations({
        recommendedTemplateIds: ["vite-react"],
        selectedTemplateId: "next",
        recommendedRecipeIds: [],
        selectedRecipeIds: [],
      }),
      true,
    );
    assert.equal(
      didChangeDiscoveryRecommendations({
        recommendedTemplateIds: ["hono"],
        selectedTemplateId: "hono",
        recommendedRecipeIds: ["prisma"],
        selectedRecipeIds: [],
      }),
      true,
    );
  });

  it("recovers from corrupted storage", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(options.storePath, "{not-json", "utf8");

    const store = loadDiscoveryFeedbackStore(options);
    assert.equal(store.sessions.length, 0);
    assert.equal(store.feedbackEnabled, true);
    assert.equal(parseDiscoveryFeedbackStore("[]").sessions.length, 0);
  });

  it("enforces retention limits", () => {
    const sessions: DiscoverySessionRecord[] = Array.from({ length: 105 }, (_, index) =>
      buildDiscoverySessionRecord(
        draft({
          selectedTemplateId: index % 2 === 0 ? "vite-react" : "hono",
          startedAtMs: Date.now() - index,
        }),
        { status: "completed", generationSucceeded: true, nowMs: Date.now() + index },
      ),
    );
    const trimmed = trimDiscoverySessions(sessions);
    assert.equal(trimmed.length, DISCOVERY_FEEDBACK_MAX_SESSIONS);
    assert.equal(trimmed[0]?.id, sessions[5]?.id);

    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);
    saveDiscoveryFeedbackStore({ schemaVersion: 1, feedbackEnabled: true, sessions }, options);
    assert.equal(
      loadDiscoveryFeedbackStore(options).sessions.length,
      DISCOVERY_FEEDBACK_MAX_SESSIONS,
    );
  });

  it("skips recording when feedback is disabled", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);
    assert.equal(setDiscoveryFeedbackEnabled(false, options), true);
    assert.equal(isDiscoveryFeedbackEnabled(options), false);
    assert.equal(recordDiscoverySession(draft(), { status: "completed" }, options), false);
    assert.equal(loadDiscoveryFeedbackStore(options).sessions.length, 0);

    const envDisabled = storeOptions(tempConfigDir(), { ZEALAKIT_DISCOVERY_FEEDBACK: "0" });
    dirs.push(path.dirname(envDisabled.storePath));
    assert.equal(isDiscoveryFeedbackEnabled(envDisabled), false);
    assert.equal(recordDiscoverySession(draft(), {}, envDisabled), false);
  });

  it("never throws when the store path is unwritable", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const notADirectory = path.join(dir, "not-a-directory");
    fs.writeFileSync(notADirectory, "x", "utf8");
    const storePath = path.join(notADirectory, "discovery-feedback.json");
    assert.doesNotThrow(() => {
      assert.equal(recordDiscoverySession(draft(), { status: "completed" }, { storePath }), false);
    });
  });
});

describe("discovery feedback stats", () => {
  it("shows a useful empty state", () => {
    const text = formatDiscoveryFeedbackStats(
      computeDiscoveryFeedbackStats({
        schemaVersion: 1,
        feedbackEnabled: true,
        sessions: [],
      }),
    );
    assert.match(text, /No local Discovery feedback yet/i);
    assert.match(text, /discovery feedback disable/i);
  });

  it("aggregates offline statistics and quality signals", () => {
    const sessions: DiscoverySessionRecord[] = [];
    for (let i = 0; i < 6; i++) {
      sessions.push(
        buildDiscoverySessionRecord(
          draft({
            selectedTemplateId: "next",
            recommendedTemplateIds: ["vite-react", "next"],
            changedRecommendations: true,
            selectedRecipeIds: [],
            recommendedRecipeIds: ["prisma"],
          }),
          { status: "completed", generationSucceeded: true, nowMs: Date.now() + i },
        ),
      );
    }
    sessions.push(
      buildDiscoverySessionRecord(draft({ status: "cancelled", hadCompatibleTemplate: true }), {
        nowMs: Date.now() + 100,
      }),
    );
    sessions.push(
      buildDiscoverySessionRecord(
        draft({ status: "no_match", hadCompatibleTemplate: false, selectedTemplateId: undefined }),
        { nowMs: Date.now() + 101 },
      ),
    );

    const stats = computeDiscoveryFeedbackStats({
      schemaVersion: 1,
      feedbackEnabled: true,
      sessions,
    });
    assert.equal(stats.totalSessions, 8);
    assert.equal(stats.completedSessions, 6);
    assert.equal(stats.cancelledSessions, 1);
    assert.equal(stats.noMatchSessions, 1);
    assert.ok((stats.firstTemplateOverrideRate ?? 0) > 0.5);
    assert.ok(stats.mostSelectedTemplates.some((entry) => entry.id === "next"));
    assert.ok(stats.signals.length >= 1);

    const text = formatDiscoveryFeedbackStats(stats);
    assert.match(text, /Sessions:\s+8/);
    assert.match(text, /Diagnostic signals/);
  });

  it("clears retained sessions", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const options = storeOptions(dir);
    recordDiscoverySession(draft(), { status: "completed", generationSucceeded: true }, options);
    assert.equal(clearDiscoveryFeedbackSessions(options), true);
    assert.equal(loadDiscoveryFeedbackStore(options).sessions.length, 0);
  });
});

describe("discovery CLI commands", () => {
  function runCli(args: string[], configDir: string, env: NodeJS.ProcessEnv = {}) {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", ZEALAKIT_CONFIG_DIR: configDir, ...env },
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  it("prints empty stats offline", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const result = runCli(["discovery", "stats"], dir);
    assert.equal(result.status, ExitCode.OK);
    assert.match(result.stdout, /No local Discovery feedback yet/i);
  });

  it("supports feedback status / disable / enable / clear", () => {
    const dir = tempConfigDir();
    dirs.push(dir);

    const status = runCli(["discovery", "feedback", "status"], dir);
    assert.equal(status.status, ExitCode.OK);
    assert.match(status.stdout, /enabled/i);

    const disabled = runCli(["discovery", "feedback", "disable"], dir);
    assert.equal(disabled.status, ExitCode.OK);
    assert.match(disabled.stdout, /disabled/i);

    const stillDisabled = runCli(["discovery", "feedback", "status"], dir);
    assert.match(stillDisabled.stdout, /disabled/i);

    const enabled = runCli(["discovery", "feedback", "enable"], dir);
    assert.equal(enabled.status, ExitCode.OK);
    assert.match(enabled.stdout, /enabled/i);

    recordDiscoverySession(
      draft(),
      { status: "completed", generationSucceeded: true },
      storeOptions(dir),
    );
    const cleared = runCli(["discovery", "feedback", "clear"], dir);
    assert.equal(cleared.status, ExitCode.OK);
    assert.match(cleared.stdout, /Cleared/i);
    assert.equal(loadDiscoveryFeedbackStore(storeOptions(dir)).sessions.length, 0);
  });

  it("rejects unknown feedback actions", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const result = runCli(["discovery", "feedback", "upload"], dir);
    assert.equal(result.status, ExitCode.USAGE);
  });

  it("keeps create --help backward compatible", () => {
    const dir = tempConfigDir();
    dirs.push(dir);
    const result = runCli(["create", "--help"], dir);
    assert.equal(result.status, ExitCode.OK);
    assert.match(result.stdout, /--discover/);
  });
});
