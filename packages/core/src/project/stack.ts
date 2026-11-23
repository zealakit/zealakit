import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ScaffoldValidationError } from "../diagnostics.js";
import { fse } from "../fs-extra.js";
import type { PackageManager } from "../package-manager.js";
import { getTemplate, withDefaultRecipes } from "../registry/index.js";
import { commitStagedDirectory } from "../scaffold/commit.js";
import { stagePlan } from "../scaffold/index.js";
import { KIT_VERSION } from "../scaffold/paths.js";
import { buildScaffoldPlan, planIsReady, type ScaffoldPlan } from "../scaffold/plan.js";
import { directoryHasFiles, nonEmptyTargetMessage } from "../validation/target-dir.js";

/**
 * Stacks: one workspace root with several apps (`apps/<name>`), each a normal
 * zealakit project (its own `zealakit.json`, recipes, agent docs), plus a
 * `packages/contracts` package for shared types.
 *
 * The root `zealakit.json` has `schemaVersion: 2` and indexes the members.
 */

export const STACK_MANIFEST_SCHEMA_VERSION = 2;
export const STACK_MANIFEST_FILE = "zealakit.json";
const MEMBER_NAME = /^[a-z][a-z0-9-]*$/;

export type StackMemberSpec = { name: string; templateId: string; recipeIds: string[] };

export type StackManifest = {
  $schema: string;
  schemaVersion: 2;
  kitVersion: string;
  createdAt: string;
  stack: Record<
    string,
    { dir: string; template: string; recipes: string[]; requestedRecipes: string[] }
  >;
  /** Recipes applied once at the workspace root (none are supported yet). */
  root: { recipes: string[] };
};

export type StackSpecResult =
  | { ok: true; members: StackMemberSpec[] }
  | { ok: false; errors: string[] };

/** Parse `web=next,api=hono` plus `web:mui,api:prisma` recipe assignments. */
export function parseStackSpec(stack: string, recipes: string[] = []): StackSpecResult {
  const errors: string[] = [];
  const members: StackMemberSpec[] = [];
  for (const part of stack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const [name, templateId, ...rest] = part.split("=");
    if (!name || !templateId || rest.length > 0 || !MEMBER_NAME.test(name)) {
      errors.push(`'${part}' is not a valid stack member; use name=template (e.g. web=next).`);
      continue;
    }
    if (members.some((member) => member.name === name)) {
      errors.push(`Duplicate stack member '${name}'.`);
      continue;
    }
    members.push({ name, templateId, recipeIds: [] });
  }
  if (members.length < 2 && errors.length === 0) {
    errors.push("A stack needs at least two members, e.g. --stack web=next,api=hono.");
  }
  for (const entry of recipes) {
    const [target, recipe, ...rest] = entry.split(":");
    if (!target || !recipe || rest.length > 0) {
      errors.push(`'${entry}' must be written member:recipe (e.g. web:mui).`);
      continue;
    }
    if (target === "root") {
      errors.push(`Root-level recipes ('${entry}') are not supported yet; add recipes per member.`);
      continue;
    }
    const member = members.find((candidate) => candidate.name === target);
    if (!member) {
      errors.push(`'${entry}': unknown stack member '${target}'.`);
      continue;
    }
    member.recipeIds.push(recipe);
  }
  for (const member of members) {
    const template = getTemplate(member.templateId);
    if (!template)
      errors.push(`Unknown template '${member.templateId}' for member '${member.name}'.`);
    else if ((template.ecosystem ?? "node") !== "node") {
      errors.push(
        `Member '${member.name}': stacks support Node templates only (got ${template.id}).`,
      );
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, members };
}

export type StackPlan = {
  projectName: string;
  targetDir: string;
  packageManager: PackageManager;
  members: Array<{ spec: StackMemberSpec; dir: string; plan: ScaffoldPlan }>;
  /** Workspace files written by the stack itself. */
  rootFiles: string[];
  blockers: string[];
  warnings: string[];
};

const CONTRACT_FILES = ["packages/contracts/package.json", "packages/contracts/src/index.ts"];

function rootFileList(pm: PackageManager): string[] {
  return [
    "package.json",
    ...(pm === "pnpm" ? ["pnpm-workspace.yaml"] : []),
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".gitignore",
    ...CONTRACT_FILES,
    STACK_MANIFEST_FILE,
  ];
}

export function buildStackPlan(
  projectName: string,
  members: StackMemberSpec[],
  options: { cwd: string; packageManager?: PackageManager },
): StackPlan {
  const packageManager = options.packageManager ?? "npm";
  const targetDir = path.resolve(options.cwd, projectName);
  const result: StackPlan = {
    projectName,
    targetDir,
    packageManager,
    members: [],
    rootFiles: rootFileList(packageManager),
    blockers: [],
    warnings: [],
  };
  for (const spec of members) {
    const template = getTemplate(spec.templateId);
    if (!template) {
      result.blockers.push(`Unknown template '${spec.templateId}'.`);
      continue;
    }
    const plan = buildScaffoldPlan(
      {
        projectName: `${projectName}-${spec.name}`,
        templateId: spec.templateId,
        recipeIds: withDefaultRecipes(template.scope, spec.recipeIds),
        packageManager,
      },
      options.cwd,
      { requestedRecipeIds: spec.recipeIds },
    );
    if (!planIsReady(plan)) {
      result.blockers.push(...plan.blockers.map((blocker) => `[${spec.name}] ${blocker}`));
    }
    result.members.push({ spec, dir: `apps/${spec.name}`, plan });
  }
  const ports = result.members.filter((member) => member.plan.config.templateId !== "vite-react");
  if (ports.length > 1) {
    result.warnings.push(
      "Several members listen on port 3000 by default; set a different PORT per app when running them together.",
    );
  }
  return result;
}

function rootPackageJson(plan: StackPlan): string {
  const pm = plan.packageManager;
  const run = (script: string): string =>
    pm === "pnpm"
      ? `pnpm -r --if-present run ${script}`
      : pm === "yarn"
        ? `yarn workspaces foreach -A run ${script}`
        : pm === "bun"
          ? `bun run --filter '*' ${script}`
          : `npm run ${script} --workspaces --if-present`;
  const pkg = {
    name: plan.projectName,
    private: true,
    version: "0.0.0",
    ...(pm === "pnpm" ? {} : { workspaces: ["apps/*", "packages/*"] }),
    scripts: { build: run("build"), lint: run("lint"), test: run("test") },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function writeRootFiles(plan: StackPlan, stageDir: string): void {
  const write = (relative: string, content: string): void => {
    const file = path.join(stageDir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
  };
  write("package.json", rootPackageJson(plan));
  if (plan.packageManager === "pnpm") {
    write("pnpm-workspace.yaml", `packages:\n  - apps/*\n  - packages/*\n`);
  }
  const apps = plan.members
    .map((member) => `- \`${member.dir}\` — ${member.spec.templateId}`)
    .join("\n");
  write(
    "README.md",
    `# ${plan.projectName}\n\nA zealakit stack.\n\n${apps}\n- \`packages/contracts\` — shared types\n\nEach app is a regular zealakit project: run commands inside it, or from the root with the workspace scripts (\`build\`, \`lint\`, \`test\`). Add recipes with \`zealakit add <recipe> --app <name>\`.\n${plan.warnings.map((warning) => `\n> ${warning}\n`).join("")}`,
  );
  write(
    "AGENTS.md",
    `# Agent instructions\n\nThis is a workspace with one project per app. Read each app's own \`AGENTS.md\` before changing it.\n\n${plan.members.map((member) => `- [${member.dir}/AGENTS.md](${member.dir}/AGENTS.md)`).join("\n")}\n- Shared types live in \`packages/contracts\`; import them from apps instead of duplicating shapes.\n`,
  );
  write("CLAUDE.md", "@AGENTS.md\n");
  write(".gitignore", "node_modules\ndist\n.env\n.env.*\n!.env.example\n");
  write(
    "packages/contracts/package.json",
    `${JSON.stringify(
      {
        name: `${plan.projectName}-contracts`,
        private: true,
        version: "0.0.0",
        type: "module",
        main: "./src/index.ts",
        types: "./src/index.ts",
      },
      null,
      2,
    )}\n`,
  );
  write(
    "packages/contracts/src/index.ts",
    `/** Shapes shared between apps. Keep API request/response types here. */
export type ApiError = { message: string };

export type Item = { id: string; name: string };

/** Minimal typed client; replace the paths with your API. */
export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(\`\${baseUrl}\${path}\`, init);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: response.statusText }))) as ApiError;
      throw new Error(body.message);
    }
    return (await response.json()) as T;
  }
  return {
    listItems: () => request<Item[]>("/api/v1/items"),
  };
}
`,
  );
  const manifest: StackManifest = {
    $schema: `https://unpkg.com/zealakit@${KIT_VERSION}/schema/zealakit-stack.schema.json`,
    schemaVersion: 2,
    kitVersion: KIT_VERSION,
    createdAt: new Date().toISOString(),
    stack: Object.fromEntries(
      plan.members.map((member) => [
        member.spec.name,
        {
          dir: member.dir,
          template: member.plan.config.templateId,
          recipes: member.plan.config.recipeIds,
          requestedRecipes: member.plan.selectedIds,
        },
      ]),
    ),
    root: { recipes: [] },
  };
  write(STACK_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Stage every member plus the workspace files, then commit atomically. */
export function executeStackPlan(
  plan: StackPlan,
  options: { overwrite?: "refuse" | "allow" } = {},
): string {
  if (plan.blockers.length > 0)
    throw new ScaffoldValidationError(plan.blockers.join("\n"), plan.blockers);
  if (options.overwrite === "refuse" && directoryHasFiles(plan.targetDir)) {
    const message = nonEmptyTargetMessage(plan.projectName);
    throw new ScaffoldValidationError(message, [message]);
  }
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-stack-"));
  try {
    writeRootFiles(plan, stageDir);
    for (const member of plan.members) {
      const staged = stagePlan(member.plan);
      try {
        const destination = path.join(stageDir, member.dir);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fse.copySync(staged.dir, destination, { overwrite: true, errorOnExist: false });
      } finally {
        staged.dispose();
      }
    }
    commitStagedDirectory(stageDir, plan.targetDir);
    return plan.targetDir;
  } catch (error) {
    fse.removeSync(stageDir);
    throw error;
  }
}

export type StackManifestParse =
  | { ok: true; manifest: StackManifest }
  | { ok: false; errors: string[] };

/** `undefined` when the directory has no manifest or it is not a stack (schemaVersion 1). */
export function readStackManifest(dir: string): StackManifestParse | undefined {
  const file = path.join(dir, STACK_MANIFEST_FILE);
  if (!fs.existsSync(file)) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return undefined;
  }
  const data = json as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || data.schemaVersion !== STACK_MANIFEST_SCHEMA_VERSION) {
    return undefined;
  }
  const stack = data.stack;
  const valid =
    typeof stack === "object" &&
    stack !== null &&
    Object.values(stack).every((member) => {
      const m = member as Record<string, unknown>;
      return (
        typeof m.dir === "string" && typeof m.template === "string" && Array.isArray(m.recipes)
      );
    });
  if (!valid)
    return {
      ok: false,
      errors: [
        `${STACK_MANIFEST_FILE}: 'stack' must map member names to { dir, template, recipes }.`,
      ],
    };
  return { ok: true, manifest: data as unknown as StackManifest };
}

/** Absolute directory of a stack member, rejecting names that are not in the manifest. */
export function stackMemberDir(
  root: string,
  manifest: StackManifest,
  app: string,
): string | undefined {
  const member = manifest.stack[app];
  if (!member) return undefined;
  const dir = path.resolve(root, member.dir);
  const rel = path.relative(path.resolve(root), dir);
  return rel.startsWith("..") || path.isAbsolute(rel) ? undefined : dir;
}
