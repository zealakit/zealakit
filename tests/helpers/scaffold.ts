import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import {
  getRecipe,
  getRecipeAgentEntry,
  getTemplate,
  getTemplateOverlayId,
  resolveRecipeDependencies,
  scaffoldProject,
  validateScaffoldConfig,
  withDefaultRecipes,
} from "@zealakit/core";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

export type PackageJson = {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type ScaffoldedApp = {
  dir: string;
  templateId: string;
  recipeIds: string[];
  exists: (relativePath: string) => boolean;
  read: (relativePath: string) => string;
  json: <T = Record<string, unknown>>(relativePath: string) => T;
  pkg: () => PackageJson;
};

function toApp(dir: string, templateId: string, recipeIds: string[]): ScaffoldedApp {
  const resolve = (relativePath: string) => path.join(dir, relativePath);
  return {
    dir,
    templateId,
    recipeIds,
    exists: (relativePath) => fs.existsSync(resolve(relativePath)),
    read: (relativePath) => fs.readFileSync(resolve(relativePath), "utf-8"),
    json: (relativePath) => JSON.parse(fs.readFileSync(resolve(relativePath), "utf-8")),
    pkg: () => JSON.parse(fs.readFileSync(resolve("package.json"), "utf-8")) as PackageJson,
  };
}

/** Same resolution as the CLI: defaults → dependsOn expansion. */
export function resolveRecipeIds(templateId: string, picked: string[]): string[] {
  const template = getTemplate(templateId);
  assert.ok(template, `unknown template ${templateId}`);
  const withDefaults = withDefaultRecipes(template.scope, picked);
  const resolved = resolveRecipeDependencies(withDefaults);
  assert.equal(resolved.ok, true, "recipe dependency resolution should succeed in tests");
  return resolved.ok ? resolved.recipeIds : withDefaults;
}

/** Validates like the CLI (`-y`) and scaffolds in-process into a temp dir. */
export async function scaffold(templateId: string, picked: string[]): Promise<ScaffoldedApp> {
  const recipeIds = resolveRecipeIds(templateId, picked);
  const projectName = `app-${++counter}`;
  const config = { projectName, templateId, recipeIds };

  const validation = validateScaffoldConfig(config);
  assert.ok(validation.valid, `expected valid config:\n${validation.errors.join("\n")}`);

  const dir = await scaffoldProject(config, workRoot);
  return toApp(dir, templateId, recipeIds);
}

/** Expects the CLI validation step to reject the combination; returns the error text. */
export function expectRejected(templateId: string, picked: string[]): string {
  const recipeIds = resolveRecipeIds(templateId, picked);
  const validation = validateScaffoldConfig({ projectName: "rejected", templateId, recipeIds });
  assert.equal(
    validation.valid,
    false,
    `expected ${templateId} + ${picked.join(",")} to be rejected`,
  );
  return validation.errors.join("\n");
}

/** Properties every scaffolded app must satisfy, whatever the recipe mix. */
export function assertScaffoldInvariants(app: ScaffoldedApp): void {
  const template = getTemplate(app.templateId);
  assert.ok(template);
  const overlayId = getTemplateOverlayId(app.templateId);
  const pkg = app.pkg();

  assert.equal(pkg.name, path.basename(app.dir), "package.json name should be the project name");

  for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
    assert.ok(!app.exists(leaked), `${leaked} must not be copied into the app`);
  }
  if (template.srcDir && template.srcDir !== "src") {
    assert.ok(!app.exists("src"), `${template.id} must not keep a top-level src/`);
  }

  if (app.exists(".agents")) {
    const cursor = path.join(app.dir, ".cursor");
    assert.ok(fs.lstatSync(cursor).isSymbolicLink(), ".cursor should be a symlink");
    assert.equal(fs.readlinkSync(cursor), ".agents", ".cursor should point at .agents");
  }

  const expectedDeps: Record<string, string> = {};
  const expectedDevDeps: Record<string, string> = {};
  const expectedScripts: Record<string, string> = {};
  for (const recipeId of app.recipeIds) {
    const recipe = getRecipe(recipeId);
    assert.ok(recipe);
    Object.assign(expectedDeps, recipe.packages, recipe.overlayPackages?.[overlayId]);
    Object.assign(
      expectedDevDeps,
      recipe.devDependencies,
      recipe.overlayDevDependencies?.[overlayId],
    );
    Object.assign(expectedScripts, recipe.scripts);

    const entry = getRecipeAgentEntry(recipeId);
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      if (!entry || !app.exists(file)) continue;
      const doc = app.read(file);
      for (const line of entry.split("\n").filter((l) => l.trim())) {
        assert.ok(
          doc.includes(line.trimEnd()),
          `${file} should include agent entry of ${recipeId}`,
        );
      }
    }
  }

  for (const [name, version] of Object.entries(expectedDeps)) {
    assert.equal(pkg.dependencies?.[name], version, `dependency ${name}`);
  }
  for (const [name, version] of Object.entries(expectedDevDeps)) {
    assert.equal(pkg.devDependencies?.[name], version, `devDependency ${name}`);
  }
  for (const [name, command] of Object.entries(expectedScripts)) {
    assert.equal(pkg.scripts?.[name], command, `script ${name}`);
  }
}
