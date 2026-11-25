import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  scaffoldProject,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core/internal";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";
import { registerPythonEcosystem } from "@zealakit/ecosystem-python";

/**
 * Validate generated Python projects with the real toolchain.
 *
 * Uses `uv sync && uv run pytest` when `uv` exists (the supported flow). Without
 * uv it falls back to `python3 -m venv` + `pip install` of the pyproject
 * dependencies, so the check still runs on machines that only have Python.
 * Skipped when neither is available. Network is required to install packages.
 */

const cases: Array<{ template: string; scope: "server" | "infrastructure"; recipes: string[] }> = [
  { template: "fastapi-api", scope: "server", recipes: [] },
  { template: "fastapi-api", scope: "server", recipes: ["sqlalchemy", "alembic", "docker-python"] },
  {
    template: "fastapi-api",
    scope: "server",
    recipes: ["sqlalchemy", "postgres-python", "github-actions-python"],
  },
  { template: "python-worker", scope: "infrastructure", recipes: ["docker-python"] },
];
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-python-recipes-"));

const has = (command: string, args: string[]): boolean =>
  spawnSync(command, args, { encoding: "utf-8" }).status === 0;

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function checkWithUv(dir: string): void {
  run("uv", ["sync"], dir);
  run("uv", ["run", "pytest", "-q"], dir);
  run("uv", ["run", "ruff", "check", "."], dir);
  run("uv", ["run", "ruff", "format", "--check", "."], dir);
}

function checkWithVenv(dir: string): void {
  const venv = path.join(dir, ".venv");
  run("python3", ["-m", "venv", venv], dir);
  const bin = (name: string) =>
    path.join(venv, process.platform === "win32" ? "Scripts" : "bin", name);
  const requirements = execFileSync(
    "python3",
    [
      "-c",
      "import tomllib;d=tomllib.load(open('pyproject.toml','rb'));print('\\n'.join(d['project']['dependencies']+d['dependency-groups']['dev']))",
    ],
    { cwd: dir, encoding: "utf-8" },
  );
  const file = path.join(dir, "requirements.tmp.txt");
  fs.writeFileSync(file, requirements);
  run(bin("pip"), ["install", "-q", "--disable-pip-version-check", "-r", file], dir);
  run(bin("python"), ["-m", "pytest", "-q"], dir);
  run(bin("ruff"), ["check", "."], dir);
  run(bin("ruff"), ["format", "--check", "."], dir);
}

try {
  const useUv = has("uv", ["--version"]);
  if (!useUv && !has("python3", ["--version"])) {
    console.log("⚠ Neither uv nor python3 found; skipping generated Python validation.");
    process.exit(0);
  }
  if (!useUv) console.log("ℹ uv not found: validating with python3 -m venv + pip instead.");

  registerNodeEcosystem();
  registerPythonEcosystem();

  for (const { template, scope, recipes } of cases) {
    const config = {
      projectName: `py-${template}-${recipes.length}`,
      templateId: template,
      recipeIds: withDefaultRecipes(scope, recipes),
    };
    const validation = validateScaffoldConfig(config);
    if (!validation.valid)
      throw new Error(`${template} + ${recipes}: ${validation.errors.join("\n")}`);

    console.log(`\n→ ${template} + ${recipes.join(",") || "(none)"}`);
    const dir = await scaffoldProject(config, path.join(workRoot, "apps"));
    if (useUv) checkWithUv(dir);
    else checkWithVenv(dir);
    console.log(`✔ ${template} + ${recipes.join(",") || "(none)"}`);
  }
  console.log("\n✔ All generated Python projects passed install/pytest/ruff.");
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
