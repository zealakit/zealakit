import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PackageManager } from "../package-manager.js";
import {
  PROJECT_MANIFEST_FILE,
  type ProjectManifest,
  readProjectManifest,
  serializeProjectManifest,
} from "../project-manifest.js";
import { getRecipe } from "../registry/index.js";
import { getRecipeAgentEntry, insertAgentEntry } from "../scaffold/agent-docs.js";
import { type StagedProject, stagePlan } from "../scaffold/index.js";
import { walkFiles } from "../scaffold/inventory.js";
import { getManifestAdapter } from "../scaffold/manifest.js";
import { KIT_VERSION } from "../scaffold/paths.js";
import { buildScaffoldPlan, planIsReady } from "../scaffold/plan.js";
import type { EcosystemId, ScaffoldConfig } from "../types.js";
import { unifiedDiff } from "./diff.js";

/** One file `add` would create, modify, or could not merge. */
export type FileChange = {
  path: string;
  /** `conflict`: the project's file differs from what the kit generated; kept unless overwritten. */
  kind: "create" | "modify" | "conflict";
  /** Content that would be written (for a conflict: only with `overwriteFiles`). */
  after: Buffer;
  /** Current content in the project (absent for `create`). */
  before?: Buffer;
  /** Unified diff `before → after` (conflict: the kit's patch, to apply by hand). */
  diff?: string;
  note?: string;
};

export type AddPlan = {
  projectDir: string;
  manifest: ProjectManifest;
  /** Config the project would have after `add` (resolved apply order). */
  config: ScaffoldConfig;
  /** Recipes actually being added (requested, not yet applied). */
  added: string[];
  /** Recipes pulled in by `dependsOn` of the added ones. */
  autoInjected: string[];
  /** Requested recipes the project already has. */
  alreadyApplied: string[];
  changes: FileChange[];
  /** Dependency/script keys the merged package.json gains or changes. */
  packageChanges: { dependencies: string[]; devDependencies: string[]; scripts: string[] };
  blockers: string[];
  warnings: string[];
};

const AGENT_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);
/** Files users edit constantly; only lines the recipe added are appended. */
const APPEND_MERGE_FILES = new Set([".env.example", "go.mod", "go.sum"]);

/** The name the project was generated with (so staged output matches module paths). */
export function inferProjectName(projectDir: string, ecosystem: EcosystemId): string {
  const fallback = path.basename(projectDir);
  try {
    if (ecosystem === "go") {
      const goMod = fs.readFileSync(path.join(projectDir, "go.mod"), "utf-8");
      const module = /^module\s+(\S+)/m.exec(goMod)?.[1];
      if (module)
        return module.startsWith("example.com/") ? module.slice("example.com/".length) : module;
    } else {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8")) as {
        name?: unknown;
      };
      if (typeof pkg.name === "string" && pkg.name) return pkg.name;
    }
  } catch {
    // fall through to the directory name
  }
  return fallback;
}

function isText(buffer: Buffer): boolean {
  return !buffer.includes(0);
}

function readIfFile(file: string): Buffer | undefined {
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile() ? fs.readFileSync(file) : undefined;
  } catch {
    return undefined;
  }
}

function listFiles(dir: string): Map<string, string> {
  const files = walkFiles(dir);
  for (const [relative, absolute] of files) {
    // Symlinks (the `.cursor` link) are recreated by the pipeline, not merged.
    if (fs.lstatSync(absolute).isSymbolicLink()) files.delete(relative);
  }
  return files;
}

type JsonObject = Record<string, unknown>;
const PACKAGE_SECTIONS = ["dependencies", "devDependencies", "scripts"] as const;

/** Apply only the package.json keys the new recipes changed onto the project's file. */
function mergePackageJson(
  current: Buffer,
  before: Buffer,
  after: Buffer,
  packageChanges: AddPlan["packageChanges"],
): Buffer | undefined {
  let project: JsonObject;
  let oldJson: JsonObject;
  let newJson: JsonObject;
  try {
    project = JSON.parse(current.toString("utf-8")) as JsonObject;
    oldJson = JSON.parse(before.toString("utf-8")) as JsonObject;
    newJson = JSON.parse(after.toString("utf-8")) as JsonObject;
  } catch {
    return undefined;
  }
  for (const section of PACKAGE_SECTIONS) {
    const next = (newJson[section] ?? {}) as Record<string, string>;
    const prev = (oldJson[section] ?? {}) as Record<string, string>;
    const target = { ...((project[section] ?? {}) as Record<string, string>) };
    for (const [key, value] of Object.entries(next)) {
      if (prev[key] !== value) {
        target[key] = value;
        packageChanges[section].push(key);
      }
    }
    if (Object.keys(target).length > 0) project[section] = target;
  }
  return Buffer.from(`${JSON.stringify(project, null, 2)}\n`, "utf-8");
}

/** Append the lines the recipe added that the project does not have yet. */
function appendMerge(current: Buffer, before: Buffer, after: Buffer, relative: string): Buffer {
  const existing = current.toString("utf-8");
  const had = new Set(before.toString("utf-8").split("\n"));
  const present = new Set(existing.split("\n"));
  const added = after
    .toString("utf-8")
    .split("\n")
    .filter((line) => !had.has(line) && !present.has(line));
  if (added.length === 0) return current;
  // go.sum is a flat list; everything else gets a blank-line separated block.
  const separator = relative === "go.sum" ? "\n" : "\n\n";
  return Buffer.from(
    `${existing.trimEnd()}${separator}${added.filter((l) => l !== "").join("\n")}\n`,
    "utf-8",
  );
}

function stage(config: ScaffoldConfig): { staged: StagedProject; blockers: string[] } {
  const plan = buildScaffoldPlan(config, os.tmpdir(), { manifest: false });
  if (!planIsReady(plan)) {
    return { staged: { dir: "", dispose: () => {} }, blockers: plan.blockers };
  }
  return { staged: stagePlan(plan), blockers: [] };
}

/**
 * Plan adding recipes to an existing project.
 *
 * Replay strategy: generate the project twice with the current kit — with and
 * without the new recipes — and apply only the difference to the real project.
 * A pristine project therefore ends up identical to `create -w <all recipes>`,
 * while files the user edited are reported as conflicts instead of overwritten.
 */
export function planAddRecipes(
  projectDir: string,
  requestedRecipeIds: string[],
  options: { packageManager?: PackageManager } = {},
): AddPlan {
  const root = path.resolve(projectDir);
  const loaded = readProjectManifest(root);
  const empty = (blockers: string[], manifest?: ProjectManifest): AddPlan => ({
    projectDir: root,
    manifest: manifest as ProjectManifest,
    config: {
      projectName: path.basename(root),
      templateId: manifest?.template ?? "",
      recipeIds: [],
    },
    added: [],
    autoInjected: [],
    alreadyApplied: [],
    changes: [],
    packageChanges: { dependencies: [], devDependencies: [], scripts: [] },
    blockers,
    warnings: [],
  });

  if (!loaded) {
    return empty([
      `No ${PROJECT_MANIFEST_FILE} in '${root}'. \`zealakit add\` needs a project generated by zealakit 1.0.0-beta.4 or newer (or run it with --cwd <project>).`,
    ]);
  }
  if (!loaded.ok) return empty(loaded.errors);
  const { manifest } = loaded;

  const alreadyApplied = requestedRecipeIds.filter((id) => manifest.recipes.includes(id));
  const toAdd = requestedRecipeIds.filter((id) => !manifest.recipes.includes(id));
  const projectName = inferProjectName(root, manifest.ecosystem);
  const baseConfig: ScaffoldConfig = {
    projectName,
    templateId: manifest.template,
    recipeIds: [...manifest.recipes],
    ...(options.packageManager ? { packageManager: options.packageManager } : {}),
  };
  const newConfig: ScaffoldConfig = { ...baseConfig, recipeIds: [...manifest.recipes, ...toAdd] };

  const result = empty([], manifest);
  result.alreadyApplied = alreadyApplied;
  result.config = newConfig;

  if (toAdd.length === 0) return result;

  const oldStage = stage(baseConfig);
  if (oldStage.blockers.length > 0) {
    result.blockers.push(...oldStage.blockers);
    return result;
  }
  let newStage: ReturnType<typeof stage> | undefined;
  try {
    newStage = stage(newConfig);
    if (newStage.blockers.length > 0) {
      result.blockers.push(...newStage.blockers);
      return result;
    }
    // The effective config (with `dependsOn` resolved) comes from a plan, not the raw input.
    const effective = buildScaffoldPlan(newConfig, os.tmpdir(), { manifest: false }).config;
    result.config = effective;
    result.added = toAdd;
    result.autoInjected = effective.recipeIds.filter(
      (id) => !manifest.recipes.includes(id) && !toAdd.includes(id),
    );

    if (manifest.kitVersion !== KIT_VERSION) {
      // Files are compared against what the *installed* kit generates for the old recipes.
      result.warnings.push(
        `Project was generated by zealakit ${manifest.kitVersion}; changes are computed against the installed kit's output, so files that differ will show as conflicts.`,
      );
    }
    computeChanges(root, oldStage.staged.dir, newStage.staged.dir, result);
    return result;
  } finally {
    oldStage.staged.dispose();
    newStage?.staged.dispose();
  }
}

function computeChanges(projectDir: string, oldDir: string, newDir: string, plan: AddPlan): void {
  const oldFiles = listFiles(oldDir);
  const newFiles = listFiles(newDir);
  // Apply order matters: each agent entry is inserted after the Structure bullet.
  const newIds = new Set([...plan.added, ...plan.autoInjected]);
  const addedRecipes = plan.config.recipeIds.filter((id) => newIds.has(id));

  for (const [relative, newAbsolute] of [...newFiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (relative === PROJECT_MANIFEST_FILE) continue;
    const after = fs.readFileSync(newAbsolute);
    const oldAbsolute = oldFiles.get(relative);
    const before = oldAbsolute ? fs.readFileSync(oldAbsolute) : undefined;
    if (before?.equals(after)) continue; // unchanged by the new recipes

    const current = readIfFile(path.join(projectDir, relative));
    const push = (change: Omit<FileChange, "path">): void => {
      plan.changes.push({ path: relative, ...change });
    };
    const textDiff = (from: Buffer, to: Buffer): string | undefined =>
      isText(from) && isText(to)
        ? unifiedDiff(from.toString("utf-8"), to.toString("utf-8"), relative)
        : undefined;

    // New file in the project.
    if (!current) {
      push({
        kind: "create",
        after,
        diff: isText(after) ? unifiedDiff("", after.toString("utf-8"), relative) : undefined,
      });
      continue;
    }
    if (current.equals(after)) continue; // already in place

    // Agent docs: insert each added recipe's entry line instead of replacing the file.
    if (AGENT_FILES.has(relative)) {
      let text = current.toString("utf-8");
      for (const id of addedRecipes) {
        const entry = getRecipeAgentEntry(id);
        if (entry) text = insertAgentEntry(text, entry);
      }
      const merged = Buffer.from(text, "utf-8");
      if (!merged.equals(current)) {
        push({ kind: "modify", before: current, after: merged, diff: textDiff(current, merged) });
      }
      continue;
    }

    const adapterMerge = before
      ? getManifestAdapter(plan.manifest.ecosystem).mergeProjectFile?.(relative, {
          current,
          before,
          after,
        })
      : undefined;
    if (adapterMerge) {
      for (const key of PACKAGE_SECTIONS)
        plan.packageChanges[key].push(...adapterMerge.changed[key]);
      if (!adapterMerge.content.equals(current)) {
        push({
          kind: "modify",
          before: current,
          after: adapterMerge.content,
          diff: textDiff(current, adapterMerge.content),
        });
      }
      continue;
    }

    if (relative === "package.json" && before) {
      const merged = mergePackageJson(current, before, after, plan.packageChanges);
      if (merged && !merged.equals(current)) {
        push({ kind: "modify", before: current, after: merged, diff: textDiff(current, merged) });
      }
      if (merged) continue;
    }

    if (APPEND_MERGE_FILES.has(relative) && before) {
      const merged = appendMerge(current, before, after, relative);
      if (!merged.equals(current)) {
        push({ kind: "modify", before: current, after: merged, diff: textDiff(current, merged) });
      }
      continue;
    }

    // Untouched since generation → safe to update.
    if (before && current.equals(before)) {
      push({ kind: "modify", before: current, after, diff: textDiff(current, after) });
      continue;
    }

    // The user changed this file: keep theirs, show the kit's patch to apply by hand.
    push({
      kind: "conflict",
      before: current,
      after,
      diff: before ? textDiff(before, after) : textDiff(current, after),
      note: before
        ? "You edited this file; apply the patch below by hand (or pass --overwrite-files)."
        : "File already exists with different content (or --overwrite-files to replace).",
    });
  }
  for (const key of PACKAGE_SECTIONS) plan.packageChanges[key].sort();
}

export type ApplyAddOptions = {
  /** Replace conflicting files with the kit's version (originals are backed up). */
  overwriteFiles?: boolean;
  now?: Date;
};

export type ApplyAddResult = {
  created: string[];
  modified: string[];
  skippedConflicts: string[];
  overwritten: string[];
};

function resolveInside(root: string, relative: string): string {
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write outside the project: ${relative}`);
  }
  return target;
}

/** Existing `externalRecipes` plus any newly added external recipe, keyed by id. */
function mergeExternals(plan: AddPlan): Pick<ProjectManifest, "externalRecipes"> {
  const byId = new Map((plan.manifest.externalRecipes ?? []).map((item) => [item.id, item]));
  for (const id of plan.config.recipeIds) {
    const external = getRecipe(id)?.external;
    if (external) byId.set(id, { id, ...external });
  }
  return byId.size > 0 ? { externalRecipes: [...byId.values()] } : {};
}

/**
 * Write only the changed files. Overwritten files are backed up under
 * `.zealakit/backup-<ts>/` and restored if anything fails; the backup is
 * removed on success.
 */
export function applyAddPlan(plan: AddPlan, options: ApplyAddOptions = {}): ApplyAddResult {
  if (plan.blockers.length > 0) throw new Error(plan.blockers.join("\n"));
  const root = plan.projectDir;
  const stamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(root, ".zealakit", `backup-${stamp}`);
  const result: ApplyAddResult = {
    created: [],
    modified: [],
    skippedConflicts: [],
    overwritten: [],
  };

  const writes: Array<{ change: FileChange; overwrite: boolean }> = [];
  for (const change of plan.changes) {
    if (change.kind === "conflict") {
      if (!options.overwriteFiles) {
        result.skippedConflicts.push(change.path);
        continue;
      }
      writes.push({ change, overwrite: true });
    } else {
      writes.push({ change, overwrite: false });
    }
  }

  const backedUp: string[] = [];
  const createdNow: string[] = [];
  try {
    for (const { change } of writes) {
      const target = resolveInside(root, change.path);
      if (change.before !== undefined && fs.existsSync(target)) {
        const backup = path.join(backupDir, change.path);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(target, backup);
        backedUp.push(change.path);
      } else {
        createdNow.push(target);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, change.after);
    }

    const manifestFile = path.join(root, PROJECT_MANIFEST_FILE);
    const manifestBackup = path.join(backupDir, PROJECT_MANIFEST_FILE);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(manifestFile, manifestBackup);
    fs.writeFileSync(
      manifestFile,
      serializeProjectManifest({
        ...plan.manifest,
        recipes: plan.config.recipeIds,
        ...mergeExternals(plan),
        requestedRecipes: [
          ...plan.manifest.requestedRecipes,
          ...plan.added.filter((id) => !plan.manifest.requestedRecipes.includes(id)),
        ],
      }),
      "utf-8",
    );
  } catch (error) {
    for (const relative of backedUp) {
      fs.copyFileSync(path.join(backupDir, relative), path.join(root, relative));
    }
    const manifestBackup = path.join(backupDir, PROJECT_MANIFEST_FILE);
    if (fs.existsSync(manifestBackup))
      fs.copyFileSync(manifestBackup, path.join(root, PROJECT_MANIFEST_FILE));
    for (const file of createdNow) fs.rmSync(file, { force: true });
    throw error;
  }

  for (const { change, overwrite } of writes) {
    if (overwrite) result.overwritten.push(change.path);
    else if (change.kind === "create") result.created.push(change.path);
    else result.modified.push(change.path);
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
  const zealakitDir = path.join(root, ".zealakit");
  if (fs.existsSync(zealakitDir) && fs.readdirSync(zealakitDir).length === 0)
    fs.rmdirSync(zealakitDir);
  return result;
}

/** Recipe ids the project already has, from its manifest (empty when absent/invalid). */
export function appliedRecipes(projectDir: string): string[] {
  const loaded = readProjectManifest(projectDir);
  return loaded?.ok ? loaded.manifest.recipes : [];
}

/** Whether a recipe id is registered (used for friendly CLI errors). */
export function isKnownRecipe(id: string): boolean {
  return getRecipe(id) !== undefined;
}
