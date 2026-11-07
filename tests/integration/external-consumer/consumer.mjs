import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Independent consumer test.
 *
 * This file must only talk to the installed `zealakit` executable. It does not
 * import @zealakit/* packages or read the source workspace.
 */

const ROOT = process.cwd();
const BIN = path.join(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "zealakit.cmd" : "zealakit",
);
const CONFIG_DIR = path.join(ROOT, ".zealakit-config");

fs.mkdirSync(CONFIG_DIR, { recursive: true });

function run(args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, args, {
      cwd,
      env: {
        ...(() => {
          const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...env } = process.env;
          return env;
        })(),
        NO_COLOR: "1",
        ZEALAKIT_CONFIG_DIR: CONFIG_DIR,
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function runOk(result, label) {
  assert.equal(result.status, 0, `${label} failed:\n${result.stderr || result.stdout}`);
  assert.ok(!result.stdout.includes("\u001b["), `${label} stdout contains ANSI escapes`);
  assert.ok(!result.stderr.includes("\u001b["), `${label} stderr contains ANSI escapes`);
  return result;
}

function parseInfo(result, label) {
  const ok = runOk(result, label);
  assert.equal(ok.stderr, "", `${label} should not write to stderr`);
  assert.ok(!ok.stdout.includes("\u001b["), `${label} stdout contains ANSI escapes`);
  return JSON.parse(ok.stdout);
}

const passed = [];
function pass(name) {
  passed.push(name);
  console.log(`✔ ${name}`);
}

function projectName(prefix) {
  return `${prefix}-${process.pid}-${Date.now()}`.toLowerCase();
}

async function main() {
  assert.ok(fs.existsSync(BIN), `installed executable not found: ${BIN}`);

  // ── CLI surface ──────────────────────────────────────────────────────────
  const help = runOk(await run(["--help"]), "--help");
  for (const command of ["create", "info", "doctor", "discovery"]) {
    assert.ok(help.stdout.includes(command), `--help should list ${command}`);
  }
  pass("CLI help output");

  const version = runOk(await run(["--version"]), "--version");
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+(-[\w.]+)?$/);
  pass("CLI version output");

  const doctor = parseInfo(await run(["doctor", "--json"]), "doctor --json");
  assert.equal(doctor.zealakit?.name, "zealakit");
  assert.equal(typeof doctor.zealakit?.version, "string");
  assert.equal(doctor.node?.status, "ready");
  pass("CLI doctor JSON");

  const humanInfo = runOk(await run(["info"]), "info");
  assert.match(humanInfo.stdout, /Templates/);
  assert.match(humanInfo.stdout, /Recipes/);
  assert.doesNotMatch(humanInfo.stdout, /^\s*\{/m);
  pass("CLI human info");

  // ── Info JSON ────────────────────────────────────────────────────────────
  const info = parseInfo(await run(["info", "--json"]), "info --json");

  assert.equal(info.schemaVersion, 4);
  assert.equal(info.command, "info");
  assert.deepEqual(info.filters, {});
  assert.ok(Array.isArray(info.data.ecosystems) && info.data.ecosystems.length > 0);
  assert.ok(Array.isArray(info.data.templates) && info.data.templates.length > 0);
  assert.ok(Array.isArray(info.data.recipes) && info.data.recipes.length > 0);
  assert.ok(Array.isArray(info.data.capabilities) && info.data.capabilities.length > 0);
  assert.equal(typeof info.data.cli?.version, "string");
  pass("info JSON envelope and catalog");

  const nodeEcosystem = info.data.ecosystems.find(
    (ecosystem) => ecosystem.templates.length > 0 && ecosystem.recipes.length > 0,
  );
  assert.ok(nodeEcosystem, "expected a Node.js ecosystem with templates and recipes");
  const goEcosystem = info.data.ecosystems.find(
    (ecosystem) => ecosystem.id !== nodeEcosystem.id && ecosystem.templates.length > 0,
  );
  assert.ok(goEcosystem, "expected a second ecosystem with templates");
  pass("Node and Go ecosystem metadata");

  const template =
    info.data.templates.find(
      (entry) =>
        entry.ecosystem === nodeEcosystem.id &&
        entry.scope === "client" &&
        entry.compatibleRecipes.length > 0,
    ) ?? info.data.templates.find((entry) => entry.compatibleRecipes.length > 0);
  assert.ok(template, "expected a template with compatible recipes");

  const recipeById = new Map(info.data.recipes.map((recipe) => [recipe.id, recipe]));
  const recipe =
    template.compatibleRecipes
      .map((id) => recipeById.get(id))
      .find((entry) => entry && !entry.default && entry.exclusive) ??
    template.compatibleRecipes
      .map((id) => recipeById.get(id))
      .find((entry) => entry && !entry.default);
  assert.ok(recipe, "expected a selectable recipe from template.compatibleRecipes");
  assert.ok(template.compatibleRecipes.includes(recipe.id));
  assert.ok(recipe.templates.includes(template.id));
  pass("metadata-driven template and recipe selection");

  const withIncompatibleTemplates = info.data.recipes.find(
    (entry) => entry.incompatibleTemplates.length > 0,
  );
  assert.ok(withIncompatibleTemplates, "expected at least one compatibility explanation");
  assert.equal(typeof withIncompatibleTemplates.incompatibleTemplates[0]?.code, "string");
  assert.equal(typeof withIncompatibleTemplates.incompatibleTemplates[0]?.message, "string");
  pass("compatibility metadata with reasons");

  // ── Filters ──────────────────────────────────────────────────────────────
  const server = parseInfo(
    await run(["info", "--json", "--scope", "server"]),
    "info --scope server",
  );
  assert.deepEqual(server.filters, { scope: "server" });
  assert.ok(server.data.templates.length > 0);
  assert.ok(server.data.templates.every((entry) => entry.scope === "server"));
  pass("scope filter");

  const go = parseInfo(
    await run(["info", "--json", "--ecosystem", goEcosystem.id]),
    "info --ecosystem go",
  );
  assert.deepEqual(go.filters, { ecosystem: goEcosystem.id });
  assert.ok(go.data.templates.length > 0);
  assert.ok(go.data.templates.every((entry) => entry.ecosystem === goEcosystem.id));
  pass("Go ecosystem filter");

  const byTemplate = parseInfo(
    await run(["info", "--json", "--template", template.id]),
    "info --template",
  );
  assert.deepEqual(byTemplate.filters, { templateId: template.id });
  assert.deepEqual(
    byTemplate.data.templates.map((entry) => entry.id),
    [template.id],
  );
  assert.ok(byTemplate.data.recipes.every((entry) => entry.templates.includes(template.id)));
  pass("template filter and relation ids");

  const capability = info.data.capabilities.find((entry) => entry.templates.length > 0);
  assert.ok(capability, "expected a capability with template members");
  const byCapability = parseInfo(
    await run(["info", "--json", "--capability", capability.id]),
    "info --capability",
  );
  assert.deepEqual(byCapability.filters, { capability: capability.id });
  assert.deepEqual(
    byCapability.data.capabilities.map((entry) => entry.id),
    [capability.id],
  );
  assert.ok(byCapability.data.templates.every((entry) => capability.templates.includes(entry.id)));
  pass("capability filter");

  const withDiscovery = parseInfo(
    await run(["info", "--json", "--discover", "--template", template.id]),
    "info --discover",
  );
  assert.equal(withDiscovery.data.templates[0]?.discovery?.id, template.id);
  pass("Discovery profile metadata");

  const first = await run(["info", "--json"]);
  const second = await run(["info", "--json"]);
  assert.equal(first.stdout, second.stdout);
  pass("deterministic JSON output");

  // ── Invalid metadata queries ─────────────────────────────────────────────
  const invalidFilter = await run(["info", "--json", "--scope", "desktop"]);
  assert.equal(invalidFilter.status, 2);
  assert.equal(invalidFilter.stdout, "");
  assert.ok(invalidFilter.stderr.length > 0);
  pass("invalid info filter: exit 2, empty stdout");

  const missingValue = await run(["info", "--scope"]);
  assert.equal(missingValue.status, 2);
  assert.equal(missingValue.stdout, "");
  assert.ok(missingValue.stderr.length > 0);
  pass("invalid info arguments: exit 2, empty stdout");

  // ── Project creation ─────────────────────────────────────────────────────
  const appsDir = path.join(ROOT, "apps");
  fs.mkdirSync(appsDir, { recursive: true });
  const appName = projectName("consumer-app");

  const created = await run(["create", appName, "-t", template.id, "-w", recipe.id, "-y"], appsDir);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  assert.ok(!created.stdout.includes("\u001b["), "create stdout contains ANSI escapes");

  const appDir = path.join(appsDir, appName);
  assert.ok(fs.existsSync(path.join(appDir, "package.json")));
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));

  assert.equal(pkg.name, appName);
  const overlay = template.overlay;
  const expectedDependencies = {
    ...recipe.packages,
    ...(recipe.overlayPackages?.[overlay] ?? {}),
  };
  const expectedDevDependencies = {
    ...recipe.devDependencies,
    ...(recipe.overlayDevDependencies?.[overlay] ?? {}),
  };
  for (const [name, version] of Object.entries(expectedDependencies)) {
    assert.equal(pkg.dependencies?.[name], version, `dependency ${name}`);
  }
  for (const [name, version] of Object.entries(expectedDevDependencies)) {
    assert.equal(pkg.devDependencies?.[name], version, `devDependency ${name}`);
  }
  for (const [name, command] of Object.entries(recipe.scripts)) {
    assert.equal(pkg.scripts?.[name], command, `script ${name}`);
  }

  assert.ok(fs.existsSync(path.join(appDir, "AGENTS.md")));
  const cursor = path.join(appDir, ".cursor");
  assert.ok(fs.lstatSync(cursor).isSymbolicLink());
  assert.equal(fs.readlinkSync(cursor), ".agents");
  assert.ok(!fs.existsSync(path.join(appDir, "_gitignore")));
  pass("project creation with selected template and recipe");

  // ── Error handling ───────────────────────────────────────────────────────
  const invalidTemplate = await run(
    ["create", projectName("bad-template"), "-t", "__missing_template__", "-y"],
    appsDir,
  );
  assert.equal(invalidTemplate.status, 3);
  assert.equal(invalidTemplate.stdout, "");
  assert.ok(invalidTemplate.stderr.length > 0);
  pass("invalid template: exit 3");

  const invalidRecipe = await run(
    ["create", projectName("bad-recipe"), "-t", template.id, "-w", "__missing_recipe__", "-y"],
    appsDir,
  );
  assert.equal(invalidRecipe.status, 3);
  assert.equal(invalidRecipe.stdout, "");
  assert.ok(invalidRecipe.stderr.length > 0);
  pass("invalid recipe: exit 3");

  const incompatibleRecipe = info.data.recipes.find(
    (entry) => !entry.default && !entry.templates.includes(template.id),
  );
  assert.ok(incompatibleRecipe, "expected an incompatible recipe for the selected template");
  const incompatible = await run(
    ["create", projectName("bad-combo"), "-t", template.id, "-w", incompatibleRecipe.id, "-y"],
    appsDir,
  );
  assert.equal(incompatible.status, 3);
  assert.equal(incompatible.stdout, "");
  assert.ok(incompatible.stderr.length > 0);
  pass("incompatible template/recipe: exit 3");

  const existingTarget = await run(
    ["create", appName, "-t", template.id, "-w", recipe.id, "-y"],
    appsDir,
  );
  assert.equal(existingTarget.status, 3);
  assert.equal(existingTarget.stdout, "");
  assert.ok(existingTarget.stderr.length > 0);
  pass("existing output directory: exit 3");

  const invalidArgument = await run(["create", projectName("bad-arg"), "--nope", "-y"], appsDir);
  assert.equal(invalidArgument.status, 2);
  assert.equal(invalidArgument.stdout, "");
  assert.ok(invalidArgument.stderr.length > 0);
  pass("invalid command argument: exit 2");

  console.log(`\nAll ${passed.length} external consumer checks passed.`);
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
