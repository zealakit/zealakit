import fs from "node:fs";
import path from "node:path";
import {
  assertStagingRealPath,
  type FinalizeContext,
  resolveStagingPath,
} from "@zealakit/core/ecosystem";
import { defineRecipe } from "./define.js";
import { renderNodeWorkflow } from "./github-actions-workflow.js";

export const WORKFLOW_FILE = ".github/workflows/ci.yml";

function writeWorkflow(targetDir: string, { config }: FinalizeContext): void {
  const file = resolveStagingPath(targetDir, WORKFLOW_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(file));
  fs.writeFileSync(
    file,
    renderNodeWorkflow({
      packageManager: config.packageManager ?? "npm",
      templateId: config.templateId,
      recipeIds: config.recipeIds,
    }),
    "utf-8",
  );
}

export default defineRecipe({
  id: "github-actions",
  discovery: { capabilities: [], projectTypes: ["ui", "server-api"] },
  name: "GitHub Actions",
  hint: "CI workflow: install, lint, test, build (follows your other recipes)",
  category: "ci",
  supportedScopes: "all",
  exclusive: true,
  finalize: writeWorkflow,
});
