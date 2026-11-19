import type { FinalizeContext } from "@zealakit/core/ecosystem";
import { writeStagedFile } from "../shared.js";
import { defineRecipe } from "./define.js";

export const WORKFLOW_FILE = ".github/workflows/ci.yml";

export type PythonWorkflowContext = { recipeIds: readonly string[] };

/** Pure generator: same context in, same YAML out. */
export function renderPythonWorkflow({ recipeIds }: PythonWorkflowContext): string {
  const steps = [
    "      - uses: actions/checkout@v4",
    "      - uses: astral-sh/setup-uv@v5",
    "      - name: Install dependencies",
    "        run: uv sync",
    "      - name: Lint",
    "        run: uv run ruff check .",
    "      - name: Format check",
    "        run: uv run ruff format --check .",
    "      - name: Test",
    "        run: uv run pytest",
  ];
  if (recipeIds.includes("docker-python")) {
    steps.push("      - name: Build Docker image", "        run: docker build -t app .");
  }
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
${steps.join("\n")}
`;
}

export default defineRecipe({
  id: "github-actions-python",
  discovery: { capabilities: [], projectTypes: ["server-api", "background-worker"] },
  name: "GitHub Actions",
  hint: "CI workflow: uv sync, ruff, pytest",
  category: "ci",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  finalize(targetDir: string, { config }: FinalizeContext) {
    writeStagedFile(
      targetDir,
      WORKFLOW_FILE,
      renderPythonWorkflow({ recipeIds: config.recipeIds }),
    );
  },
});
