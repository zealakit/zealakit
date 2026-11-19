import fs from "node:fs";
import path from "node:path";
import {
  assertStagingRealPath,
  type FinalizeContext,
  resolveStagingPath,
} from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";

export const WORKFLOW_FILE = ".github/workflows/ci.yml";

export type GoWorkflowContext = { recipeIds: readonly string[] };

/** Pure generator: same context in, same YAML out. */
export function renderGoWorkflow({ recipeIds }: GoWorkflowContext): string {
  const steps = [
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-go@v5",
    "        with:",
    "          go-version-file: go.mod",
    "      - name: Download modules",
    "        run: go mod download",
    "      - name: Vet",
    "        run: go vet ./...",
    "      - name: Test",
    "        run: go test ./...",
    "      - name: Build",
    "        run: go build ./...",
  ];
  if (recipeIds.includes("docker-go")) {
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

function writeWorkflow(targetDir: string, { config }: FinalizeContext): void {
  const file = resolveStagingPath(targetDir, WORKFLOW_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(file));
  fs.writeFileSync(file, renderGoWorkflow({ recipeIds: config.recipeIds }), "utf-8");
}

export default defineGoRecipe({
  id: "github-actions-go",
  discovery: { capabilities: [], projectTypes: ["server-api", "background-worker"] },
  name: "GitHub Actions",
  hint: "CI workflow: go vet, go test, go build",
  category: "ci",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  finalize: writeWorkflow,
});
