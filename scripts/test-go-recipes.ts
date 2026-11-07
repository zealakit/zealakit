import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scaffoldProject, validateScaffoldConfig } from "@zealakit/core";
import { registerGoEcosystem } from "@zealakit/ecosystem-go";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";

/**
 * Validate generated Go projects with the real toolchain.
 *
 * Network is required for `go mod tidy` the first time. Set `GOSUMDB=off` only
 * when the environment cannot reach the checksum database.
 */

const templates = ["stdlib-api", "gin-api", "stdlib-worker"] as const;
const databaseRecipes = ["postgres", "mysql", "mongodb"] as const;
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-go-recipes-"));

function goAvailable(): boolean {
  const result = spawnSync("go", ["version"], { encoding: "utf-8" });
  return result.status === 0;
}

function runGo(args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  execFileSync("go", args, { cwd, env, stdio: "inherit" });
}

function makeWritable(target: string): void {
  if (!fs.existsSync(target)) return;
  if (!fs.lstatSync(target).isDirectory()) return;
  fs.chmodSync(target, 0o700);
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      makeWritable(child);
    } else if (!entry.isSymbolicLink()) {
      fs.chmodSync(child, 0o600);
    }
  }
}

try {
  if (!goAvailable()) {
    console.log("⚠ Go toolchain not found; skipping generated Go validation.");
    process.exit(0);
  }

  registerNodeEcosystem();
  registerGoEcosystem();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GOCACHE: path.join(workRoot, "go-cache"),
    GOMODCACHE: path.join(workRoot, "go-mod-cache"),
    GOTOOLCHAIN: "local",
  };

  for (const templateId of templates) {
    for (const recipeId of databaseRecipes) {
      const config = {
        projectName: `go-${templateId}-${recipeId}`,
        templateId,
        recipeIds: [recipeId],
      };
      const validation = validateScaffoldConfig(config);
      if (!validation.valid) {
        throw new Error(`${templateId} + ${recipeId}: ${validation.errors.join("\n")}`);
      }

      console.log(`\n→ ${templateId} + ${recipeId}`);
      const dir = await scaffoldProject(config, path.join(workRoot, "apps"));
      runGo(["mod", "tidy"], dir, env);
      runGo(["test", "./..."], dir, env);
      runGo(["vet", "./..."], dir, env);
      console.log(`✔ ${templateId} + ${recipeId}`);
    }
  }

  console.log("\n✔ All generated Go projects passed tidy/test/vet.");
} finally {
  try {
    makeWritable(workRoot);
    fs.rmSync(workRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    console.warn(
      `⚠ Could not remove temporary Go validation directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
