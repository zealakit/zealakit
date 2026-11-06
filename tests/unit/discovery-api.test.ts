import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  DISCOVERY_API_ERROR_CODES,
  DISCOVERY_API_SCHEMA_VERSION,
  type DiscoveryApiErrorResponse,
  type DiscoveryApiResponse,
  type DiscoveryQuestionsData,
  type DiscoveryRecommendationsData,
  type DiscoveryValidationData,
  handleDiscoveryRequest,
  PACKAGE_ROOT,
} from "@zealakit/core";

async function call(body: Record<string, unknown>): Promise<DiscoveryApiResponse> {
  return handleDiscoveryRequest({ schemaVersion: DISCOVERY_API_SCHEMA_VERSION, ...body });
}

function questionsData(response: DiscoveryApiResponse): DiscoveryQuestionsData {
  assert.equal(response.ok, true);
  assert.equal(response.operation, "questions");
  return (response as Extract<DiscoveryApiResponse, { operation: "questions" }>).data;
}

function recommendationsData(response: DiscoveryApiResponse): DiscoveryRecommendationsData {
  assert.equal(response.ok, true);
  assert.equal(response.operation, "recommendations");
  return (response as Extract<DiscoveryApiResponse, { operation: "recommendations" }>).data;
}

function validationData(response: DiscoveryApiResponse): DiscoveryValidationData {
  assert.equal(response.ok, true);
  assert.equal(response.operation, "validate");
  return (response as Extract<DiscoveryApiResponse, { operation: "validate" }>).data;
}

function errorData(response: DiscoveryApiResponse): DiscoveryApiErrorResponse {
  assert.equal(response.ok, false);
  return response as DiscoveryApiErrorResponse;
}

describe("Discovery API — questions", () => {
  it("returns the first question for an empty answer set", async () => {
    const data = questionsData(await call({ operation: "questions", answers: {} }));
    assert.equal(data.question?.id, "projectType");
    assert.equal(data.complete, false);
    assert.deepEqual(data.answered, []);
    assert.deepEqual(data.progress, { answered: 0, total: 1 });
  });

  it("returns the next applicable question for partial answers", async () => {
    const ui = questionsData(
      await call({ operation: "questions", answers: { projectType: "ui" } }),
    );
    assert.equal(ui.question?.id, "websiteKind");
    assert.deepEqual(ui.answered, ["projectType"]);
    assert.ok(ui.progress.total > ui.progress.answered);

    const server = questionsData(
      await call({ operation: "questions", answers: { projectType: "server-api" } }),
    );
    assert.equal(server.question?.id, "serviceGoals");
    assert.notEqual(server.question?.id, "websiteKind");
  });

  it("excludes inapplicable questions from the active branch", async () => {
    const data = questionsData(
      await call({ operation: "questions", answers: { projectType: "background-worker" } }),
    );
    assert.equal(data.question?.id, "backendRuntime");
    assert.ok(!data.answered.includes("websiteKind"));
  });

  it("completes the branch and then produces recommendations", async () => {
    let answers: Record<string, unknown> = {};
    let steps = 0;
    while (steps < 40) {
      const data = questionsData(await call({ operation: "questions", answers }));
      if (data.complete) break;
      const question = data.question;
      assert.ok(question);
      const value = question.type === "multi-select" ? [] : question.options[0]?.value;
      assert.ok(value !== undefined, `${question.id} has no options`);
      answers = { ...answers, [question.id]: value };
      steps += 1;
    }
    assert.ok(steps < 40, "question flow should complete");
    assert.equal(questionsData(await call({ operation: "questions", answers })).complete, true);

    const recommendations = await call({ operation: "recommendations", answers });
    assert.equal(recommendations.ok, true);
    assert.equal(recommendations.operation, "recommendations");
  });

  it("rejects invalid answers with structured details", async () => {
    const invalid = errorData(
      await call({ operation: "questions", answers: { projectType: "nope" } }),
    );
    assert.equal(invalid.error.code, DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS);
    assert.ok(invalid.error.details.some((detail) => detail.includes("nope")));

    const unknown = errorData(
      await call({ operation: "questions", answers: { projectType: "ui", unknownKey: true } }),
    );
    assert.equal(unknown.error.code, DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS);
    assert.ok(unknown.error.details.some((detail) => detail.includes("unknownKey")));
  });

  it("reports unsupported project types in recommendations", async () => {
    const data = questionsData(
      await call({ operation: "questions", answers: { projectType: "complete-product" } }),
    );
    assert.equal(data.complete, true);

    const response = errorData(
      await call({
        operation: "recommendations",
        answers: { projectType: "complete-product" },
      }),
    );
    assert.equal(response.error.code, DISCOVERY_API_ERROR_CODES.UNSUPPORTED_PROJECT_TYPE);
  });
});

describe("Discovery API — recommendations", () => {
  const answers = {
    projectType: "server-api",
    backendRuntime: "node",
    apiStorageNeed: "relational",
  };

  it("returns ranked templates and recipes with reasons", async () => {
    const data = recommendationsData(await call({ operation: "recommendations", answers }));
    assert.equal(data.recommendedTemplateId, "hono");
    assert.ok(data.templates.length > 0);
    assert.ok(data.recipes.length > 0);
    assert.ok(data.templates[0]?.reasons.length);
    for (const template of data.templates) {
      assert.equal(typeof template.templateId, "string");
      assert.equal(typeof template.score, "number");
      for (const reason of template.reasons) {
        assert.equal(typeof reason.code, "string");
        assert.ok(reason.weight === null || typeof reason.weight === "number");
      }
    }
    for (const recipe of data.recipes) {
      assert.equal(typeof recipe.recipeId, "string");
      assert.equal(typeof recipe.role, "string");
    }
  });

  it("is deterministic for identical requests", async () => {
    const first = await call({ operation: "recommendations", answers });
    const second = await call({ operation: "recommendations", answers });
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it("rejects missing or invalid answers", async () => {
    assert.equal(
      errorData(await call({ operation: "recommendations" })).error.code,
      DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
    );
    assert.equal(
      errorData(await call({ operation: "recommendations", answers: {} })).error.code,
      DISCOVERY_API_ERROR_CODES.INVALID_ANSWERS,
    );
  });
});

describe("Discovery API — validate", () => {
  it("accepts a valid selection and reports resolved recipes", async () => {
    const data = validationData(
      await call({
        operation: "validate",
        selection: { templateId: "vite-react", recipeIds: [] },
      }),
    );
    assert.equal(data.valid, true);
    assert.deepEqual(data.errors, []);
    assert.equal(data.templateId, "vite-react");
    assert.ok(data.resolvedRecipeIds.includes("client-shared-pieces"));
  });

  it("rejects unknown template and recipe ids", async () => {
    const template = errorData(
      await call({ operation: "validate", selection: { templateId: "nope", recipeIds: [] } }),
    );
    assert.equal(template.error.code, DISCOVERY_API_ERROR_CODES.UNKNOWN_TEMPLATE);

    const recipe = errorData(
      await call({ operation: "validate", selection: { templateId: "nest", recipeIds: ["nope"] } }),
    );
    assert.equal(recipe.error.code, DISCOVERY_API_ERROR_CODES.UNKNOWN_RECIPE);
    assert.deepEqual(recipe.error.details, ["nope"]);
  });

  it("detects incompatible recipes", async () => {
    const data = validationData(
      await call({
        operation: "validate",
        selection: { templateId: "next", recipeIds: ["pinia"] },
      }),
    );
    assert.equal(data.valid, false);
    assert.ok(
      data.errors.some((error) => error.code === DISCOVERY_API_ERROR_CODES.INCOMPATIBLE_RECIPE),
    );
  });

  it("detects exclusive-category conflicts", async () => {
    const data = validationData(
      await call({
        operation: "validate",
        selection: { templateId: "vite-react", recipeIds: ["mui", "antd"] },
      }),
    );
    assert.equal(data.valid, false);
    assert.ok(
      data.errors.some((error) => error.code === DISCOVERY_API_ERROR_CODES.RECIPE_CONFLICT),
    );
  });

  it("detects selections incompatible with the submitted answers", async () => {
    const data = validationData(
      await call({
        operation: "validate",
        answers: { projectType: "ui", uiTechPreference: "vue" },
        selection: { templateId: "next", recipeIds: [] },
      }),
    );
    assert.equal(data.valid, false);
    assert.ok(
      data.errors.some((error) => error.code === DISCOVERY_API_ERROR_CODES.INCOMPATIBLE_TEMPLATE),
    );
  });

  it("requires a selection object", async () => {
    const response = errorData(await call({ operation: "validate" }));
    assert.equal(response.error.code, DISCOVERY_API_ERROR_CODES.INVALID_SELECTION);
  });
});

describe("Discovery API — contract", () => {
  it("always includes schemaVersion and serializable data", async () => {
    const responses = [
      await call({ operation: "questions", answers: {} }),
      await call({
        operation: "recommendations",
        answers: { projectType: "server-api", apiStorageNeed: "none" },
      }),
      await call({ operation: "validate", selection: { templateId: "nest", recipeIds: [] } }),
      await call({ operation: "questions", answers: { projectType: "nope" } }),
    ];
    const containsFunction = (value: unknown): boolean => {
      if (typeof value === "function") return true;
      if (Array.isArray(value)) return value.some(containsFunction);
      if (value !== null && typeof value === "object") {
        return Object.values(value).some(containsFunction);
      }
      return false;
    };
    for (const response of responses) {
      assert.equal(response.schemaVersion, DISCOVERY_API_SCHEMA_VERSION);
      assert.equal(containsFunction(response), false);
      const serialized = JSON.parse(JSON.stringify(response)) as typeof response;
      assert.equal(
        JSON.stringify(JSON.parse(JSON.stringify(serialized))),
        JSON.stringify(serialized),
      );
    }
  });

  it("rejects malformed requests with stable codes", async () => {
    assert.equal(
      errorData(await handleDiscoveryRequest(null)).error.code,
      DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
    );
    assert.equal(
      errorData(await handleDiscoveryRequest({ operation: "questions" })).error.code,
      DISCOVERY_API_ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION,
    );
    assert.equal(
      errorData(
        await handleDiscoveryRequest({
          schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
          operation: "nope",
        }),
      ).error.code,
      DISCOVERY_API_ERROR_CODES.UNKNOWN_OPERATION,
    );
    assert.equal(
      errorData(
        await handleDiscoveryRequest({
          schemaVersion: DISCOVERY_API_SCHEMA_VERSION,
          operation: "questions",
          answers: [],
        }),
      ).error.code,
      DISCOVERY_API_ERROR_CODES.INVALID_REQUEST,
    );
  });

  it("keeps Discovery metadata modules free of terminal prompt dependencies", async () => {
    const offenders: string[] = [];
    for (const directory of ["discovery", "profiles", "info"]) {
      const sourceRoot = path.join(PACKAGE_ROOT, "packages/core/src", directory);
      const visit = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            visit(fullPath);
            continue;
          }
          if (!entry.name.endsWith(".ts")) continue;
          if (fs.readFileSync(fullPath, "utf-8").includes("@clack/prompts")) {
            offenders.push(path.relative(PACKAGE_ROOT, fullPath));
          }
        }
      };
      visit(sourceRoot);
    }
    assert.deepEqual(offenders, []);
  });
});
