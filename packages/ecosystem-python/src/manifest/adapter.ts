import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertStagingRealPath,
  emptyPackagePlan,
  getRecipe,
  getTemplate,
  getTemplateDevCommand,
  type ManifestAdapter,
  type ManifestFieldConflict,
  type NextSteps,
  type NextStepsOptions,
  type PackagePlan,
  type PostGenerateOptions,
  type PostGenerateResult,
  type ProjectDependency,
  type ProjectFileMerge,
  resolveStagingPath,
  type ScaffoldConfig,
  type ValidationResult,
} from "@zealakit/core/ecosystem";
import {
  DEPENDENCIES,
  DEV_GROUP,
  formatRequirement,
  mergeRequirements,
  normalizeName,
  parseRequirement,
  readStringArray,
  setProjectName,
  writeStringArray,
} from "../toml.js";
import { isValidPythonProjectName } from "../validation/project-name.js";

type Requirements = Record<string, string>;

/** Dependencies the selected recipes contribute, as `name -> spec`. */
function recipeRequirements(config: ScaffoldConfig): {
  dependencies: Requirements;
  devDependencies: Requirements;
  conflicts: ManifestFieldConflict[];
} {
  const dependencies: Requirements = {};
  const devDependencies: Requirements = {};
  const owners = new Map<string, { recipeId: string; value: string }>();
  const conflicts: ManifestFieldConflict[] = [];

  for (const recipeId of config.recipeIds) {
    const manifest = getRecipe(recipeId)?.manifest;
    if (manifest?.ecosystem !== "python") continue;
    for (const [field, target, source] of [
      ["dependencies", dependencies, manifest.dependencies],
      ["devDependencies", devDependencies, manifest.devDependencies],
    ] as const) {
      for (const [name, spec] of Object.entries(source)) {
        const key = `${field}:${normalizeName(parseRequirement(name).name)}`;
        const owner = owners.get(key);
        if (owner && owner.value !== spec) {
          conflicts.push({
            field,
            key: name,
            left: { recipeId: owner.recipeId, value: owner.value },
            right: { recipeId, value: spec },
          });
          continue;
        }
        owners.set(key, { recipeId, value: spec });
        target[name] = spec;
      }
    }
  }
  return { dependencies, devDependencies, conflicts };
}

function toRequirements(record: Requirements): string[] {
  return Object.entries(record).map(([name, spec]) => formatRequirement(name, spec));
}

function readPyproject(dir: string): string | undefined {
  const file = path.join(dir, "pyproject.toml");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : undefined;
}

function declared(source: string): { dependencies: string[]; dev: string[] } {
  return {
    dependencies: readStringArray(source, DEPENDENCIES.header, DEPENDENCIES.key),
    dev: readStringArray(source, DEV_GROUP.header, DEV_GROUP.key),
  };
}

function withRequirements(source: string, dependencies: string[], dev: string[]): string {
  let next = source;
  if (dependencies.length > 0) {
    const merged = mergeRequirements(
      readStringArray(next, DEPENDENCIES.header, DEPENDENCIES.key),
      dependencies,
    );
    next = writeStringArray(next, DEPENDENCIES.header, DEPENDENCIES.key, merged);
  }
  if (dev.length > 0) {
    const merged = mergeRequirements(readStringArray(next, DEV_GROUP.header, DEV_GROUP.key), dev);
    next = writeStringArray(next, DEV_GROUP.header, DEV_GROUP.key, merged);
  }
  return next;
}

export const pythonManifestAdapter: ManifestAdapter = {
  planMerges(config: ScaffoldConfig): PackagePlan {
    const { dependencies, devDependencies, conflicts } = recipeRequirements(config);
    return {
      ...emptyPackagePlan(),
      dependencies,
      devDependencies,
      addedDependencies: Object.keys(dependencies).sort(),
      addedDevDependencies: Object.keys(devDependencies).sort(),
      conflicts,
    };
  },

  applyMerges(targetDir: string, config: ScaffoldConfig): void {
    const file = resolveStagingPath(targetDir, "pyproject.toml");
    if (!fs.existsSync(file)) {
      throw new Error(`pyproject.toml not found in template at ${targetDir}`);
    }
    assertStagingRealPath(targetDir, file);
    const { dependencies, devDependencies, conflicts } = recipeRequirements(config);
    if (conflicts.length > 0) {
      throw new Error(
        `Conflicting dependency contributions:\n${conflicts.map((c) => `${c.key}: ${c.left.recipeId} vs ${c.right.recipeId}`).join("\n")}`,
      );
    }
    let source = setProjectName(fs.readFileSync(file, "utf-8"), config.projectName);
    source = withRequirements(
      source,
      toRequirements(dependencies),
      toRequirements(devDependencies),
    );
    fs.writeFileSync(file, source, "utf-8");
  },

  validateProjectName(name: string): ValidationResult {
    if (!name.trim()) return { valid: false, errors: ["Project name cannot be empty."] };
    if (!isValidPythonProjectName(name)) {
      return {
        valid: false,
        errors: [
          `Project name "${name}" is invalid. Use letters, digits, '-', '_' or '.' (start and end with a letter or digit).`,
        ],
      };
    }
    return { valid: true, errors: [] };
  },

  validateOutput(targetDir: string, config: ScaffoldConfig): string[] {
    const errors: string[] = [];
    const source = readPyproject(targetDir);
    if (source === undefined) return ["pyproject.toml is missing."];
    if (!/^\s*name\s*=\s*"/m.test(source)) errors.push("pyproject.toml has no [project] name.");
    if (fs.existsSync(path.join(targetDir, "package.json"))) {
      errors.push("Python templates must not include package.json.");
    }
    const { dependencies, devDependencies } = recipeRequirements(config);
    const have = declared(source);
    const names = (list: string[]) =>
      new Set(list.map((item) => normalizeName(parseRequirement(item).name)));
    const haveDeps = names(have.dependencies);
    const haveDev = names(have.dev);
    for (const name of Object.keys(dependencies)) {
      if (!haveDeps.has(normalizeName(parseRequirement(name).name)))
        errors.push(`Missing dependency ${name} in pyproject.toml.`);
    }
    for (const name of Object.keys(devDependencies)) {
      if (!haveDev.has(normalizeName(parseRequirement(name).name)))
        errors.push(`Missing dev dependency ${name} in pyproject.toml.`);
    }
    return errors;
  },

  async postGenerate(
    targetDir: string,
    _config: ScaffoldConfig,
    options: PostGenerateOptions,
  ): Promise<PostGenerateResult> {
    if (!options.install) return { install: "skipped" };
    const result = spawnSync("uv", ["sync"], {
      cwd: targetDir,
      stdio: ["ignore", 2, 2],
      shell: process.platform === "win32",
    });
    if (result.error) {
      return {
        install: "failed",
        message: "uv was not found (install: https://docs.astral.sh/uv/).",
      };
    }
    return result.status === 0
      ? { install: "ok" }
      : { install: "failed", message: `uv sync exited with code ${result.status}` };
  },

  nextSteps(config: ScaffoldConfig, options: NextStepsOptions): NextSteps {
    const template = getTemplate(config.templateId);
    const dev = template ? getTemplateDevCommand(template) : "uv run pytest";
    return {
      commands: options.installed ? [dev] : ["uv sync", dev],
      tip: "Python projects use uv (https://docs.astral.sh/uv/); `zealakit doctor` reports whether it is installed.",
    };
  },

  mergeProjectFile(relativePath, { current, before, after }): ProjectFileMerge | undefined {
    if (relativePath !== "pyproject.toml") return undefined;
    const was = declared(before.toString("utf-8"));
    const now = declared(after.toString("utf-8"));
    const added = (next: string[], prev: string[]) => next.filter((item) => !prev.includes(item));
    const dependencies = added(now.dependencies, was.dependencies);
    const dev = added(now.dev, was.dev);
    const content = Buffer.from(
      withRequirements(current.toString("utf-8"), dependencies, dev),
      "utf-8",
    );
    const names = (list: string[]) => list.map((item) => parseRequirement(item).name);
    return {
      content,
      changed: { dependencies: names(dependencies), devDependencies: names(dev), scripts: [] },
    };
  },

  readDependencies(projectDir: string): ProjectDependency[] {
    const source = readPyproject(projectDir);
    if (source === undefined) return [];
    const { dependencies, dev } = declared(source);
    const toDep =
      (field: string) =>
      (item: string): ProjectDependency => {
        const parsed = parseRequirement(item);
        return { package: parsed.name, field, range: parsed.spec };
      };
    return [...dependencies.map(toDep("dependencies")), ...dev.map(toDep("dev"))];
  },

  dependencyStatus(projectDir: string) {
    const installed = fs.existsSync(path.join(projectDir, ".venv"));
    return installed
      ? { ok: true, message: ".venv present." }
      : { ok: false, message: ".venv is missing.", fix: "uv sync" };
  },
};
