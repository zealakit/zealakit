import "../register.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { ExitCode, matchDiscovery, normalizeDiscoveryAnswers, PACKAGE_ROOT } from "@zealakit/core";
import {
  buildRecipeChoices,
  buildTemplateChoices,
  defaultSelectedRecipeIds,
} from "../../apps/cli/src/discovery/present.js";

const CLI_ENTRY = path.join(PACKAGE_ROOT, "apps/cli/src/index.ts");

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("discovery CLI presentation", () => {
  it("only lists compatible templates from the engine", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "ui",
      uiTechPreference: "react",
    });
    assert.ok(normalized.ok);
    if (!normalized.ok) return;

    const result = matchDiscovery(normalized.requirements);
    const choices = buildTemplateChoices(result);
    assert.ok(choices.length > 0);
    assert.ok(choices.every((choice) => choice.match.compatible));
    assert.ok(!choices.some((choice) => choice.value === "nest"));
    assert.equal(choices[0]?.value, result.recommendedTemplateId);
    assert.match(choices[0]?.hint ?? "", /Best match/);
    assert.match(choices[0]?.hint ?? "", /client|hybrid|server/i);
  });

  it("preselects recommended recipes and keeps one exclusive linter", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "server-api",
      backendRuntime: "node",
      apiStorageNeed: "relational",
    });
    assert.ok(normalized.ok);
    if (!normalized.ok) return;

    const templates = matchDiscovery(normalized.requirements);
    assert.ok(templates.recommendedTemplateId);
    const result = matchDiscovery(normalized.requirements, {
      templateId: templates.recommendedTemplateId,
    });
    const choices = buildRecipeChoices(result);
    assert.ok(choices.every((choice) => choice.match.relevant && choice.match.compatible));
    assert.ok(choices.some((choice) => choice.value === "biome"));

    const linters = result.recommendedRecipeIds.filter((id) => id === "biome" || id === "eslint");
    assert.deepEqual(linters, ["biome"]);

    const selected = defaultSelectedRecipeIds(result);
    assert.ok(selected.length >= 1);
    assert.ok(selected.every((id) => choices.some((choice) => choice.value === id)));
  });

  it("auto-selects only the linter for a simple website", () => {
    const normalized = normalizeDiscoveryAnswers({
      projectType: "ui",
      uiTechPreference: "react",
      websiteKind: "landing-page",
      contentChangeFrequency: "rarely",
    });
    assert.ok(normalized.ok);
    if (!normalized.ok) return;
    const templates = matchDiscovery(normalized.requirements);
    assert.ok(templates.recommendedTemplateId);
    const result = matchDiscovery(normalized.requirements, {
      templateId: templates.recommendedTemplateId,
    });
    assert.deepEqual(defaultSelectedRecipeIds(result), ["biome"]);
    assert.ok(!result.recommendedRecipeIds.includes("storybook"));
  });
});

describe("create command and discovery flags", () => {
  it("documents create and --discover in root help", () => {
    const result = runCli(["--help"]);
    assert.equal(result.status, ExitCode.OK);
    assert.match(result.stdout, /create/);
    assert.match(result.stdout, /--discover/);
  });

  it("documents modes on create --help", () => {
    const result = runCli(["create", "--help"]);
    assert.equal(result.status, ExitCode.OK);
    assert.match(result.stdout, /--discover/);
    assert.match(result.stdout, /Project Discovery/i);
    assert.match(result.stdout, /-t, --template/);
    assert.match(result.stdout, /-w, --with/);
  });

  it("rejects create --discover with -y", () => {
    const result = runCli(["create", "demo-app", "--discover", "-y"]);
    assert.equal(result.status, ExitCode.USAGE);
    assert.match(`${result.stdout}${result.stderr}`, /Discovery is interactive/i);
    assert.match(`${result.stdout}${result.stderr}`, /create --discover/);
  });

  it("rejects create --discover with --template", () => {
    const result = runCli(["create", "demo-app", "--discover", "-t", "vite-react"]);
    assert.equal(result.status, ExitCode.USAGE);
    assert.match(`${result.stdout}${result.stderr}`, /either --discover or --template/i);
  });

  it("keeps root --discover conflict checks for backward compatibility", () => {
    const result = runCli(["demo-app", "--discover", "-y"]);
    assert.equal(result.status, ExitCode.USAGE);
  });

  it("keeps explicit template help on create", () => {
    const result = runCli(["create", "--help"]);
    assert.equal(result.status, ExitCode.OK);
    assert.match(result.stdout, /vite-react/);
  });
});
