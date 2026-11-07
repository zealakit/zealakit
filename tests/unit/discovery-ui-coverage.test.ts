import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getTemplateMatchDiagnostics,
  matchDiscovery,
  normalizeDiscoveryAnswers,
  type ProjectRequirements,
} from "@zealakit/core";
import { buildTemplateChoices } from "../../apps/cli/src/discovery/present.js";

const UI_TEMPLATES = [
  "vite-react",
  "vite-vue",
  "vite-svelte",
  "astro-react-client",
  "astro-react-hybrid",
  "next",
  "nuxt",
] as const;

function fromAnswers(
  answers: Parameters<typeof normalizeDiscoveryAnswers>[0],
): ProjectRequirements {
  const normalized = normalizeDiscoveryAnswers(answers);
  if (!normalized.ok) {
    assert.fail(normalized.errors.join("; "));
  }
  return normalized.requirements;
}

function eligibleUiIds(requirements: ProjectRequirements): string[] {
  return matchDiscovery(requirements)
    .templates.filter(
      (entry) => entry.compatible && (UI_TEMPLATES as readonly string[]).includes(entry.templateId),
    )
    .map((entry) => entry.templateId);
}

function assertIncludes(ids: string[], expected: string[]): void {
  for (const id of expected) {
    assert.ok(
      ids.includes(id),
      `expected eligible pool to include '${id}', got: ${ids.join(", ")}`,
    );
  }
}

function assertExcludes(ids: string[], unexpected: string[]): void {
  for (const id of unexpected) {
    assert.ok(!ids.includes(id), `expected '${id}' to be excluded, got: ${ids.join(", ")}`);
  }
}

describe("UI Discovery candidate coverage", () => {
  it("1. basic business website keeps Vite and Astro eligible", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "business-marketing",
      contentChangeFrequency: "occasionally",
    });
    assert.equal(requirements.projectType === "ui" && requirements.frontend?.mode, undefined);
    if (requirements.projectType === "ui") {
      assert.equal(requirements.frontend?.preferredMode, "ssg");
    }
    const ids = eligibleUiIds(requirements);
    assertIncludes(ids, ["vite-react", "vite-vue", "astro-react-client", "next", "nuxt"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "astro-react-client");
  });

  it("2. landing page does not hard-exclude Vite", () => {
    const ids = eligibleUiIds(
      fromAnswers({
        projectType: "ui",
        websiteKind: "landing-page",
        contentChangeFrequency: "rarely",
      }),
    );
    assertIncludes(ids, ["vite-react", "vite-vue", "astro-react-client", "next", "nuxt"]);
  });

  it("3. static portfolio ranks Astro without dropping Vite", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "portfolio",
      contentChangeFrequency: "rarely",
    });
    const pool = eligibleUiIds(requirements);
    assertIncludes(pool, ["vite-react", "vite-svelte", "astro-react-client"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "astro-react-client");
  });

  it("4. blog / content website prefers Astro while keeping alternatives", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "blog-content",
      contentChangeFrequency: "frequently",
    });
    const ids = eligibleUiIds(requirements);
    assertIncludes(ids, ["vite-react", "vite-vue", "astro-react-client", "next", "nuxt"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "astro-react-client");
  });

  it("5. interactive management dashboard prefers Vite and keeps full-stack starters eligible", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      contentChangeFrequency: "occasionally",
      uiDataNeed: "predefined",
    });
    const ids = eligibleUiIds(requirements);
    assertIncludes(ids, ["vite-react", "vite-vue", "next", "nuxt", "astro-react-client"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "vite-react");
  });

  it("6. online store keeps client and hybrid UI templates eligible", () => {
    const ids = eligibleUiIds(
      fromAnswers({
        projectType: "ui",
        websiteKind: "online-store",
        visitorActions: ["browse-catalog"],
      }),
    );
    assertIncludes(ids, ["vite-react", "vite-vue", "vite-svelte", "next", "nuxt"]);
  });

  it("7. interactive web tool keeps Vite eligible", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "interactive-tool",
      visitorActions: ["use-interactive-tools"],
    });
    assertIncludes(eligibleUiIds(requirements), ["vite-react", "vite-vue"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "vite-react");
  });

  it("8. external API consumption does not require Next/Nuxt", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      visitorActions: ["call-existing-api", "read-information"],
      uiDataNeed: "predefined",
    });
    if (requirements.projectType === "ui") {
      assert.equal(requirements.externalApi, true);
      assert.ok(!requirements.capabilities.includes("database"));
    }
    const ids = eligibleUiIds(requirements);
    assertIncludes(ids, ["vite-react", "vite-vue", "astro-react-client", "next", "nuxt"]);
  });

  it("9a. persistent data without include-server keeps Vite eligible", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiDataNeed: "store-retrieve",
    });
    const ids = eligibleUiIds(requirements);
    assertIncludes(ids, ["vite-react", "vite-vue", "vite-svelte", "next", "nuxt"]);
    assert.equal(matchDiscovery(requirements).recommendedTemplateId, "vite-react");
  });

  it("9b. include-server excludes frontend-only templates but keeps hybrid UI starters", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "management-dashboard",
      uiDataNeed: "store-retrieve",
      uiBackendApproach: "include-server",
    });
    const ids = eligibleUiIds(requirements);
    assertExcludes(ids, ["vite-react", "vite-vue", "vite-svelte", "astro-react-client"]);
    assertIncludes(ids, ["next", "nuxt", "astro-react-hybrid"]);
  });

  it("10. explicit React preference keeps React starters only", () => {
    const ids = eligibleUiIds(
      fromAnswers({
        projectType: "ui",
        uiTechPreference: "react",
      }),
    );
    assertIncludes(ids, ["vite-react", "astro-react-client", "astro-react-hybrid", "next"]);
    assertExcludes(ids, ["vite-vue", "vite-svelte", "nuxt"]);
  });

  it("11. explicit Vue preference keeps Vue starters only", () => {
    const ids = eligibleUiIds(
      fromAnswers({
        projectType: "ui",
        uiTechPreference: "vue",
      }),
    );
    assert.deepEqual(ids.sort(), ["nuxt", "vite-vue"]);
  });

  it("12. explicit Astro preference keeps Astro starters only", () => {
    const ids = eligibleUiIds(
      fromAnswers({
        projectType: "ui",
        uiTechPreference: "astro",
      }),
    );
    assert.deepEqual(ids.sort(), ["astro-react-client", "astro-react-hybrid"]);
  });

  it("13. explicit SSR hard requirement excludes Vite and Astro client", () => {
    const requirements: ProjectRequirements = {
      projectType: "ui",
      scopes: [],
      capabilities: [],
      frontend: { mode: "ssr" },
    };
    const ids = eligibleUiIds(requirements);
    assertExcludes(ids, ["vite-react", "vite-vue", "vite-svelte", "astro-react-client"]);
    assertIncludes(ids, ["next", "nuxt", "astro-react-hybrid"]);
  });

  it("14. no framework preference leaves the full UI pool open", () => {
    const ids = eligibleUiIds(fromAnswers({ projectType: "ui" }));
    assert.deepEqual(ids.sort(), [...UI_TEMPLATES].sort());
  });

  it("15. not sure answers do not invent hard rendering filters", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "no-preference",
      contentChangeFrequency: "no-preference",
      uiTechPreference: "no-preference",
    });
    if (requirements.projectType === "ui") {
      assert.equal(requirements.frontend, undefined);
    }
    const ids = eligibleUiIds(requirements);
    assert.deepEqual(ids.sort(), [...UI_TEMPLATES].sort());
  });

  it("CLI choices expose every compatible UI template without early truncation of the pool", () => {
    const requirements = fromAnswers({
      projectType: "ui",
      websiteKind: "landing-page",
    });
    const result = matchDiscovery(requirements);
    const choices = buildTemplateChoices(result);
    assert.equal(choices.length, result.templates.filter((entry) => entry.compatible).length);
    assert.ok(choices.some((choice) => choice.value === "vite-react"));
    assert.ok(choices.some((choice) => choice.value === "astro-react-client"));
  });

  it("diagnostics explain why frontend-only templates are rejected when include-server is selected", () => {
    const result = matchDiscovery(
      fromAnswers({
        projectType: "ui",
        websiteKind: "management-dashboard",
        uiDataNeed: "store-retrieve",
        uiBackendApproach: "include-server",
      }),
    );
    const diagnostics = getTemplateMatchDiagnostics(result);
    const vite = diagnostics.find((entry) => entry.templateId === "vite-react");
    assert.ok(vite);
    assert.equal(vite.eligible, false);
    assert.ok(vite.rejectionReasons.length > 0);
    const next = diagnostics.find((entry) => entry.templateId === "next");
    assert.ok(next?.eligible);
    assert.ok(typeof next?.score === "number");
  });
});
