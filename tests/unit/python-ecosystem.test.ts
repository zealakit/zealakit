import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  applyAddPlan,
  checkProject,
  computeOutdated,
  getManifestAdapter,
  planAddRecipes,
  scaffoldProject,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core/internal";

import { composeFor } from "../../packages/ecosystem-python/src/registry/recipes/docker-python.js";
import { renderPythonWorkflow } from "../../packages/ecosystem-python/src/registry/recipes/github-actions-python.js";
import {
  mergeRequirements,
  parseRequirement,
  readProjectName,
  readStringArray,
  setProjectName,
  writeStringArray,
} from "../../packages/ecosystem-python/src/toml.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-python-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));
let counter = 0;

async function generate(template: string, recipes: string[] = []): Promise<string> {
  const scope = template === "python-worker" ? "infrastructure" : "server";
  return scaffoldProject(
    {
      projectName: `py-${++counter}`,
      templateId: template,
      recipeIds: withDefaultRecipes(scope, recipes),
    },
    path.join(workRoot, `case-${counter}`),
  );
}
const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), "utf-8");

const SAMPLE = `[project]
name = "x"
# keep this comment
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
]

[tool.ruff]
line-length = 100
`;

describe("pyproject editing", () => {
  it("reads and rewrites arrays without touching the rest of the file", () => {
    assert.deepEqual(readStringArray(SAMPLE, "[project]", "dependencies"), [
      "fastapi>=0.115",
      "uvicorn[standard]>=0.30",
    ]);
    const next = writeStringArray(SAMPLE, "[project]", "dependencies", ["fastapi>=0.115", "httpx"]);
    assert.match(next, /# keep this comment/);
    assert.match(next, /\[tool\.ruff\]\nline-length = 100/);
    assert.deepEqual(readStringArray(next, "[project]", "dependencies"), [
      "fastapi>=0.115",
      "httpx",
    ]);
  });

  it("creates missing keys and sections and renames the project", () => {
    const withGroup = writeStringArray(SAMPLE, "[dependency-groups]", "dev", ["pytest>=8"]);
    assert.deepEqual(readStringArray(withGroup, "[dependency-groups]", "dev"), ["pytest>=8"]);
    assert.equal(readProjectName(setProjectName(SAMPLE, "my-api")), "my-api");
  });

  it("merges requirements by normalized name (extras and case ignored)", () => {
    assert.deepEqual(mergeRequirements(["Fast_API>=1", "x"], ["fast-api>=2", "y"]), [
      "fast-api>=2",
      "x",
      "y",
    ]);
    assert.deepEqual(parseRequirement("uvicorn[standard]>=0.30"), {
      name: "uvicorn",
      spec: "[standard]>=0.30",
    });
  });
});

describe("python adapter", () => {
  const adapter = getManifestAdapter("python");

  it("validates PEP 508 project names", () => {
    for (const name of ["my-api", "my_api", "my.api", "a", "A1"]) {
      assert.equal(adapter.validateProjectName(name).valid, true, name);
    }
    for (const name of ["", "-x", "x-", "has space", "@scope/x"]) {
      assert.equal(adapter.validateProjectName(name).valid, false, name);
    }
  });

  it("generates a clean project with recipe dependencies merged into pyproject.toml", async () => {
    const dir = await generate("fastapi-api", ["sqlalchemy", "alembic", "postgres-python"]);
    const toml = read(dir, "pyproject.toml");
    assert.match(toml, /name = "py-\d+"/);
    const deps = readStringArray(toml, "[project]", "dependencies");
    assert.ok(deps.includes("sqlalchemy>=2.0"));
    assert.ok(deps.includes("alembic>=1.13"));
    assert.ok(deps.some((dep) => dep.startsWith("psycopg[binary]")));
    assert.match(toml, /\[tool\.ruff\.lint\]/);
    assert.equal(fs.existsSync(path.join(dir, "package.json")), false);
    assert.match(
      read(dir, "src/app/bootstrap/container.py"),
      /SqlAlchemyItemRepository\(create_session_factory\(\)\)/,
    );
    assert.match(
      read(dir, "src/app/infrastructure/persistence/database.py"),
      /AUTO_CREATE_TABLES = False/,
    );
    assert.match(read(dir, ".env.example"), /DATABASE_URL=postgresql\+psycopg/);
  });

  it("requires sqlalchemy for alembic by dependency, and orm is exclusive", () => {
    const ok = validateScaffoldConfig({
      projectName: "x",
      templateId: "fastapi-api",
      recipeIds: withDefaultRecipes("server", ["alembic"]),
    });
    assert.equal(ok.valid, true, ok.errors.join("\n"));
  });

  it("rejects recipes on the wrong template", () => {
    const bad = validateScaffoldConfig({
      projectName: "x",
      templateId: "python-worker",
      recipeIds: ["sqlalchemy"],
    });
    assert.equal(bad.valid, false);
    assert.equal(
      validateScaffoldConfig({ projectName: "x", templateId: "fastapi-api", recipeIds: ["biome"] })
        .valid,
      false,
    );
  });

  it("plans the same dependencies it writes", async () => {
    const config = { projectName: "p", templateId: "fastapi-api", recipeIds: ["sqlalchemy"] };
    assert.deepEqual(adapter.planMerges(config).addedDependencies, ["sqlalchemy"]);
  });
});

describe("generators", () => {
  it("compose adds a db service only with postgres-python", () => {
    assert.doesNotMatch(composeFor("fastapi-api", ["docker-python"]), /db:/);
    const withDb = composeFor("fastapi-api", ["docker-python", "postgres-python"]);
    assert.match(withDb, /image: postgres:/);
    assert.match(withDb, /service_healthy/);
    assert.doesNotMatch(composeFor("python-worker", []), /ports:/);
  });

  it("workflow runs uv, ruff and pytest (plus Docker when selected)", () => {
    const base = renderPythonWorkflow({ recipeIds: [] });
    assert.match(base, /uv run ruff check \./);
    assert.match(base, /uv run pytest/);
    assert.doesNotMatch(base, /docker build/);
    assert.match(renderPythonWorkflow({ recipeIds: ["docker-python"] }), /docker build -t app \./);
  });
});

describe("add / doctor / outdated for Python projects", () => {
  it("add merges dependencies into an edited pyproject.toml", async () => {
    const dir = await generate("fastapi-api");
    const file = path.join(dir, "pyproject.toml");
    fs.writeFileSync(
      file,
      read(dir, "pyproject.toml").replace('"httpx>=0.27",', '"httpx>=0.27",\n  "mypy>=1.0",'),
    );

    const plan = planAddRecipes(dir, ["sqlalchemy"]);
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.packageChanges.dependencies, ["sqlalchemy"]);
    assert.equal(plan.changes.find((change) => change.path === "pyproject.toml")?.kind, "modify");
    applyAddPlan(plan);

    const toml = read(dir, "pyproject.toml");
    assert.deepEqual(
      readStringArray(toml, "[dependency-groups]", "dev").includes("mypy>=1.0"),
      true,
    );
    assert.ok(readStringArray(toml, "[project]", "dependencies").includes("sqlalchemy>=2.0"));
  });

  it("doctor reports the missing virtualenv as info and outdated sees edited ranges", async () => {
    const dir = await generate("fastapi-api", ["sqlalchemy"]);
    const dependencies = checkProject(dir).checks.find((check) => check.id === "dependencies");
    assert.equal(dependencies?.status, "info");
    assert.equal(dependencies?.fix, "uv sync");

    assert.deepEqual(computeOutdated(dir).entries, []);
    fs.writeFileSync(
      path.join(dir, "pyproject.toml"),
      read(dir, "pyproject.toml").replace("sqlalchemy>=2.0", "sqlalchemy>=1.4"),
    );
    const report = computeOutdated(dir);
    assert.deepEqual(
      report.entries.map((entry) => [entry.package, entry.status, entry.source]),
      [["sqlalchemy", "behind", "recipe:sqlalchemy"]],
    );
  });
});
