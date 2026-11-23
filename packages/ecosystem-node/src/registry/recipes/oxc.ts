import fs from "node:fs";
import {
  assertStagingRealPath,
  type FinalizeContext,
  resolveStagingPath,
} from "@zealakit/core/ecosystem";
import { defineRecipe } from "./define.js";

const LINT_CONFIG = ".oxlintrc.json";
const FORMAT_CONFIG = ".oxfmtrc.json";

/** Recipes that bring Tailwind classes; Oxfmt sorts them when one is present. */
const TAILWIND_RECIPES = new Set(["shadcn-ui", "shadcn-vue", "nuxt-ui"]);

/**
 * Render JSON the way Oxfmt does for these small config files: objects stay
 * multi-line, arrays go inline when they fit the 100-column width. This keeps
 * `oxfmt --check` green on a freshly generated project after a finalize edit.
 */
function renderJsonConfig(value: unknown, indent = "", width = 100, prefix = 0): string {
  if (Array.isArray(value)) {
    const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    if (prefix + inline.length < width) return inline;
    return `[\n${value.map((item) => `${indent}  ${JSON.stringify(item)}`).join(",\n")}\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const body = entries
      .map(([key, item]) => {
        const keyPrefix = `${indent}  ${JSON.stringify(key)}: `;
        return `${keyPrefix}${renderJsonConfig(item, `${indent}  `, width, keyPrefix.length)}`;
      })
      .join(",\n");
    return `{\n${body}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** Edit a JSON config inside staging; no-op when the overlay does not ship it. */
function updateConfig(
  targetDir: string,
  relative: string,
  mutate: (data: Record<string, unknown>) => void,
): void {
  const file = resolveStagingPath(targetDir, relative);
  if (!fs.existsSync(file)) return;
  assertStagingRealPath(targetDir, file);
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  mutate(data);
  fs.writeFileSync(file, `${renderJsonConfig(data)}\n`, "utf-8");
}

/**
 * Cross-recipe wiring lives here because `fileTransforms` only see a single
 * recipe. Both edits are data-driven and idempotent.
 */
function finalizeOxc(targetDir: string, { config }: FinalizeContext): void {
  const recipeIds = new Set(config.recipeIds);

  if (recipeIds.has("vitest")) {
    updateConfig(targetDir, LINT_CONFIG, (data) => {
      const plugins = Array.isArray(data.plugins) ? (data.plugins as string[]) : [];
      if (!plugins.includes("vitest")) plugins.push("vitest");
      data.plugins = plugins;
    });
  }

  if ([...TAILWIND_RECIPES].some((id) => recipeIds.has(id))) {
    updateConfig(targetDir, FORMAT_CONFIG, (data) => {
      data.sortTailwindcss = true;
    });
  }
}

export default defineRecipe({
  id: "oxc",
  discovery: { capabilities: [], alwaysRelevant: true },
  name: "Oxlint + Oxfmt",
  hint: "Fast lint + format — recommended",
  category: "linter",
  supportedScopes: ["client", "server", "hybrid"],
  exclusive: true,
  devDependencies: {
    oxlint: "^1.94.0",
    oxfmt: "~0.79.0",
  },
  scripts: {
    lint: "oxlint",
    "lint:fix": "oxlint --fix",
    fmt: "oxfmt",
    "fmt:check": "oxfmt --check",
    check: "oxlint && oxfmt --check",
    "check:write": "oxlint --fix && oxfmt",
  },
  finalize: finalizeOxc,
});
