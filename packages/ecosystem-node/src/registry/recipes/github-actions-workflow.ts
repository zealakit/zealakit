import { adaptRunCommand, type PackageManager } from "@zealakit/core/ecosystem";

export type NodeWorkflowContext = {
  packageManager: PackageManager;
  templateId: string;
  /** Effective recipe ids (defaults and dependencies included). */
  recipeIds: readonly string[];
};

/** Templates that ship their own `test` script (Nest and Hono use Vitest out of the box). */
const TEMPLATES_WITH_TEST = new Set(["nest", "hono"]);

function script(pm: PackageManager, name: string): string {
  return adaptRunCommand(`npm run ${name}`, pm);
}

function installStep(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn install";
    case "bun":
      return "bun install";
    default:
      return "if [ -f package-lock.json ]; then npm ci; else npm install; fi";
  }
}

/** Pure generator: same context in, same YAML out (snapshot-tested; reused by `add`). */
export function renderNodeWorkflow(context: NodeWorkflowContext): string {
  const { packageManager: pm, recipeIds } = context;
  const steps: string[] = ["      - uses: actions/checkout@v4"];

  if (pm === "bun") {
    steps.push("      - uses: oven-sh/setup-bun@v2");
  } else {
    steps.push(
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
    );
    if (pm === "pnpm" || pm === "yarn") {
      steps.push("      - name: Enable Corepack", "        run: corepack enable");
    }
  }
  steps.push("      - name: Install dependencies", `        run: ${installStep(pm)}`);

  if (recipeIds.includes("oxc")) {
    steps.push("      - name: Lint + format (Oxc)", `        run: ${script(pm, "check")}`);
  } else if (recipeIds.includes("biome")) {
    steps.push("      - name: Lint (Biome)", `        run: ${script(pm, "check")}`);
  } else if (recipeIds.includes("eslint")) {
    steps.push("      - name: Lint (ESLint)", `        run: ${script(pm, "lint")}`);
  }
  if (recipeIds.includes("vitest") || TEMPLATES_WITH_TEST.has(context.templateId)) {
    steps.push("      - name: Test", `        run: ${script(pm, "test")}`);
  }
  steps.push("      - name: Build", `        run: ${script(pm, "build")}`);
  if (recipeIds.includes("docker")) {
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
