import path from "node:path";
import { HYBRID_ORM_WARNING, hybridOrmSelections } from "../orm-warnings.js";
import { PROJECT_MANIFEST_FILE } from "../project-manifest.js";
import { getRecipe, getTemplate, withDefaultRecipes } from "../registry/index.js";
import { formatRecipeResolveError, resolveRecipeDependencies } from "../resolve-recipes.js";
import type { ScaffoldConfig, ValidationResult } from "../types.js";
import { validateRecipeIds, validateScaffoldConfig } from "../validation/index.js";
import { directoryHasFiles } from "../validation/target-dir.js";
import { listRecipeFiles, listTemplateFiles, type PlannedFileSource } from "./inventory.js";
import { emptyPackagePlan, getManifestAdapterForConfig, type PackagePlan } from "./manifest.js";
import { getRecipeTransforms } from "./transforms.js";

export type FileAction = "create" | "replace" | "transform" | "append";

export type PlannedFile = {
  path: string;
  action: FileAction;
  sources: string[];
};

export type PlanCheck = { id: string; ok: boolean; detail?: string };

export type ScaffoldPlan = {
  config: ScaffoldConfig;
  targetDir: string;
  destinationExists: boolean;
  selectedIds: string[];
  autoInjected: string[];
  files: PlannedFile[];
  packages: PackagePlan;
  /** Whether `zealakit.json` is written into the project. */
  manifest: boolean;
  checks: PlanCheck[];
  blockers: string[];
  warnings: string[];
};

type OwnedFile = {
  source: PlannedFileSource;
  recipeId: string | undefined;
};

function pushCheck(checks: PlanCheck[], id: string, ok: boolean, detail?: string): void {
  checks.push({ id, ok, detail });
}

export type BuildPlanOptions = {
  /**
   * Recipe ids the user explicitly chose (before defaults / dependsOn).
   * When set, preview marks everything else as auto-injected.
   */
  requestedRecipeIds?: string[];
  /** Write `zealakit.json` into the project (default true). */
  manifest?: boolean;
};

/**
 * Read-only preflight and the single entry point for the pipeline's front half:
 * defaults → recipe-id validation → dependency resolution → config validation
 * → file inventory. Resolve dependencies, validate compatibility/conflicts,
 * inventory files, and detect recipe×recipe content clashes. Never writes.
 *
 * Template ← recipe overwrites are expected (action `replace`). Conflicts only
 * when two different recipes would write different bytes to the same path.
 */
export function buildScaffoldPlan(
  config: ScaffoldConfig,
  cwd: string = process.cwd(),
  options: BuildPlanOptions = {},
): ScaffoldPlan {
  const checks: PlanCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const targetDir = path.resolve(cwd, config.projectName);
  const manifest = options.manifest ?? true;
  const destinationExists = directoryHasFiles(targetDir);

  const template = getTemplate(config.templateId);
  const selectedRecipeIds = template
    ? withDefaultRecipes(template.scope, config.recipeIds)
    : config.recipeIds;

  // An unknown id is a user configuration error, not a missing `dependsOn`:
  // report it before dependency expansion so the two stay distinguishable.
  const idsCheck = validateRecipeIds(selectedRecipeIds);
  if (!idsCheck.valid) {
    blockers.push(...idsCheck.errors);
    pushCheck(checks, "recipe-ids", false, idsCheck.errors.join(" "));
    return {
      config,
      targetDir,
      destinationExists,
      selectedIds: options.requestedRecipeIds ?? config.recipeIds,
      autoInjected: [],
      files: [],
      packages: emptyPackagePlan(),
      manifest,
      checks,
      blockers: [...new Set(blockers)],
      warnings,
    };
  }

  const resolved = resolveRecipeDependencies(selectedRecipeIds);
  if (!resolved.ok) {
    const message = formatRecipeResolveError(resolved.error);
    blockers.push(message);
    pushCheck(checks, "recipe-dependencies", false, message);
    return {
      config,
      targetDir,
      destinationExists,
      selectedIds: options.requestedRecipeIds ?? config.recipeIds,
      autoInjected: [],
      files: [],
      packages: emptyPackagePlan(),
      manifest,
      checks,
      blockers,
      warnings,
    };
  }

  const requested = new Set(options.requestedRecipeIds ?? resolved.selectedIds);
  const selectedIds = resolved.recipeIds.filter((id) => requested.has(id));
  const autoInjected = resolved.recipeIds.filter((id) => !requested.has(id));

  pushCheck(
    checks,
    "recipe-dependencies",
    true,
    autoInjected.length > 0 ? `auto-injected: ${autoInjected.join(", ")}` : undefined,
  );

  const effective: ScaffoldConfig = { ...config, recipeIds: resolved.recipeIds };
  const validation: ValidationResult = validateScaffoldConfig(effective);
  pushCheck(
    checks,
    "config-validation",
    validation.valid,
    validation.valid ? undefined : validation.errors.join(" "),
  );
  if (!validation.valid) {
    blockers.push(...validation.errors);
  }
  pushCheck(checks, "template-compatibility", validation.valid);

  const packages = getManifestAdapterForConfig(effective).planMerges(effective);
  if (packages.conflicts.length > 0) {
    for (const conflict of packages.conflicts) {
      blockers.push(
        `✖ Package conflict on ${conflict.field} '${conflict.key}': '${conflict.left.recipeId}' wants '${conflict.left.value}', '${conflict.right.recipeId}' wants '${conflict.right.value}'.`,
      );
    }
    pushCheck(checks, "package-merges", false, `${packages.conflicts.length} conflict(s)`);
  } else {
    pushCheck(checks, "package-merges", true);
  }

  const files: PlannedFile[] = [];
  const filesByPath = new Map<string, PlannedFile>();
  const addFile = (file: PlannedFile): void => {
    files.push(file);
    filesByPath.set(file.path, file);
  };
  const owners = new Map<string, OwnedFile>();
  let fileConflictCount = 0;

  if (template) {
    const ormIds = hybridOrmSelections(template, effective.recipeIds);
    if (ormIds.length > 0) {
      warnings.push(`${HYBRID_ORM_WARNING} (selected: ${ormIds.join(", ")})`);
    }
  }

  if (template) {
    for (const [relative, source] of listTemplateFiles(template.id)) {
      owners.set(relative, { source, recipeId: undefined });
      addFile({ path: relative, action: "create", sources: [`template:${template.id}`] });
    }

    for (const recipeId of effective.recipeIds) {
      for (const [relative, source] of listRecipeFiles(recipeId, template.id, template)) {
        const existing = owners.get(relative);
        const label = `${source.kind}:${source.origin}`;

        if (!existing) {
          owners.set(relative, { source, recipeId });
          addFile({ path: relative, action: "create", sources: [label] });
          continue;
        }

        const planned = filesByPath.get(relative);
        if (planned && !planned.sources.includes(label)) {
          planned.sources.push(label);
        }

        // Same recipe layers (root → shared → overlay) intentionally overwrite.
        if (existing.recipeId === recipeId) {
          owners.set(relative, { source, recipeId });
          if (planned) planned.action = "replace";
          continue;
        }

        // Recipe overwrites template — expected.
        if (existing.recipeId === undefined) {
          owners.set(relative, { source, recipeId });
          if (planned) planned.action = "replace";
          continue;
        }

        // Two recipes, identical bytes — fine.
        if (existing.source.digest === source.digest) {
          continue;
        }

        // Different recipes, different bytes: later recipe wins (historical
        // scaffolder behavior). Surface as a warning in dry-run, not a blocker.
        fileConflictCount += 1;
        warnings.push(`File '${relative}': '${recipeId}' overwrites '${existing.recipeId}'.`);
        owners.set(relative, { source, recipeId });
        if (planned) planned.action = "replace";
      }

      const recipe = getRecipe(recipeId);
      if (!recipe) continue;
      for (const transform of getRecipeTransforms(recipe, template.id)) {
        const action: FileAction = transform.append !== undefined ? "append" : "transform";
        const existing = filesByPath.get(transform.file);
        if (existing) {
          existing.action = action;
          existing.sources.push(`transform:${recipeId}`);
        } else {
          addFile({
            path: transform.file,
            action,
            sources: [`transform:${recipeId}`],
          });
        }
      }
    }
  }

  pushCheck(
    checks,
    "file-overwrites",
    true,
    fileConflictCount > 0
      ? `${fileConflictCount} recipe overwrite(s) (later recipe wins)`
      : undefined,
  );
  pushCheck(
    checks,
    "destination",
    true,
    destinationExists ? "exists (overwrite required)" : "empty",
  );

  if (manifest && template && !filesByPath.has(PROJECT_MANIFEST_FILE)) {
    addFile({ path: PROJECT_MANIFEST_FILE, action: "create", sources: ["zealakit:manifest"] });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    config: effective,
    targetDir,
    destinationExists,
    selectedIds,
    autoInjected,
    files,
    packages,
    manifest,
    checks,
    blockers: [...new Set(blockers)],
    warnings,
  };
}

export function planIsReady(plan: ScaffoldPlan): boolean {
  return plan.blockers.length === 0;
}
