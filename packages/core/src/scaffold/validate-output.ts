import fs from "node:fs";
import path from "node:path";
import { getTemplate } from "../registry/index.js";
import type { ScaffoldConfig } from "../types.js";
import { getManifestAdapter, resolveTemplateEcosystem } from "./manifest.js";
import { assertStagingRealPath, assertStagingSymlinksSafe, isPathInsideRoot } from "./paths.js";

export type OutputValidation = { ok: boolean; errors: string[] };

function lstatOrUndefined(target: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(target);
  } catch {
    return undefined;
  }
}

/**
 * `.cursor` must be a relative symlink to `.agents`; the link must not escape
 * the generated project (checked both lexically and after resolving symlinks).
 */
function validateAgentConfiguration(targetDir: string, errors: string[]): void {
  const agentsDir = path.join(targetDir, ".agents");
  const cursorPath = path.join(targetDir, ".cursor");
  const cursorStat = lstatOrUndefined(cursorPath);
  const agentsExists = fs.existsSync(agentsDir);

  if (!agentsExists) {
    if (cursorStat) {
      errors.push("Generated project has '.cursor' but no '.agents' directory.");
    }
    return;
  }

  if (!fs.statSync(agentsDir).isDirectory()) {
    errors.push("Generated project '.agents' must be a directory.");
    return;
  }
  try {
    assertStagingRealPath(targetDir, agentsDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return;
  }

  if (!cursorStat) {
    errors.push("'.cursor' must be a symlink to '.agents'.");
    return;
  }
  if (!cursorStat.isSymbolicLink()) {
    errors.push("'.cursor' must be a symlink to '.agents' (found a file or directory).");
    return;
  }

  let linkTarget: string;
  try {
    linkTarget = fs.readlinkSync(cursorPath);
  } catch {
    errors.push("'.cursor' must be a readable symlink to '.agents'.");
    return;
  }
  if (linkTarget !== ".agents") {
    errors.push(`'.cursor' must point to '.agents' (found '${linkTarget}').`);
    return;
  }

  try {
    const realRoot = fs.realpathSync(targetDir);
    const realCursor = fs.realpathSync(cursorPath);
    if (!isPathInsideRoot(realRoot, realCursor)) {
      errors.push("'.cursor' resolves outside the generated project.");
    }
  } catch {
    errors.push("'.cursor' is a broken symlink.");
  }
}

/** No generated symlink may point outside the staged project. */
function validateSymlinkSafety(targetDir: string, errors: string[]): void {
  try {
    assertStagingSymlinksSafe(targetDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

function validateCommonLayout(targetDir: string, templateId: string, errors: string[]): void {
  const template = getTemplate(templateId);
  for (const leaked of ["overlays", "shared", "scaffold", "pnpm-workspace.yaml"]) {
    if (fs.existsSync(path.join(targetDir, leaked))) {
      errors.push(`Generated project must not contain '${leaked}'.`);
    }
  }

  if (template?.srcDir && template.srcDir !== "src" && fs.existsSync(path.join(targetDir, "src"))) {
    errors.push(
      `Template '${template.id}' must not keep a top-level src/ (expected fold into ${template.srcDir}/).`,
    );
  }

  if (fs.readdirSync(targetDir).length === 0) {
    errors.push("Generated project is empty.");
    return;
  }

  validateAgentConfiguration(targetDir, errors);
  validateSymlinkSafety(targetDir, errors);
}

/**
 * Structural checks on a generated (or staged) project. No network, no installs,
 * no running project scripts.
 */
export function validateGeneratedOutput(
  targetDir: string,
  config: ScaffoldConfig,
): OutputValidation {
  const errors: string[] = [];
  const template = getTemplate(config.templateId);
  if (!template) {
    return { ok: false, errors: [`Unknown template '${config.templateId}'.`] };
  }

  validateCommonLayout(targetDir, config.templateId, errors);

  // Ecosystem-specific checks (package.json / go.mod) belong to the adapter.
  errors.push(
    ...getManifestAdapter(resolveTemplateEcosystem(config.templateId)).validateOutput(
      targetDir,
      config,
    ),
  );

  return { ok: errors.length === 0, errors };
}
