import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACKED_DOTFILES } from "@zealakit/core/internal";

/**
 * Release smoke test for the published artifact: build → pack → tarball contents
 * → install once → a few real CLI runs. Scaffold behavior is covered in-process
 * by `pnpm test`; keep this file small.
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-pack-"));
const INSTALL_DIR = path.join(WORK_DIR, "install");
const APPS_DIR = path.join(WORK_DIR, "apps");

type CommandResult = { exitCode: number; output: string };

type SmokeCase = {
  name: string;
  args: string[];
  /** Optional JSON request written to stdin (Discovery JSON mode). */
  input?: string;
  /** Expected project directory for JSON scaffold cases. */
  appDirName?: string;
  check: (result: CommandResult, appDir: string | undefined) => string[];
};

const color = (code: number) => (text: string) => `\x1b[${code}m${text}\x1b[0m`;
const green = color(32);
const red = color(31);
const dim = color(2);

function run(command: string, args: string[], cwd: string, input = ""): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(input);
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

async function runOrThrow(command: string, args: string[], cwd: string): Promise<string> {
  const result = await run(command, args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.output}`);
  }
  return result.output;
}

/** Packs with pnpm, not npm: npm silently drops symlinks, pnpm (= `pnpm publish`) keeps them. */
async function packCli(): Promise<string> {
  console.log(dim("→ Building + packing CLI..."));
  await runOrThrow("pnpm", ["run", "build"], PROJECT_ROOT);
  const output = await runOrThrow(
    "pnpm",
    ["pack", "--pack-destination", PROJECT_ROOT],
    PROJECT_ROOT,
  );
  const tarballPath = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));
  if (!tarballPath) {
    throw new Error("Could not determine tarball path from pnpm pack output.");
  }
  return path.resolve(PROJECT_ROOT, tarballPath);
}

const NEVER_PACKED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".svelte-kit",
  "build",
  "storybook-static",
  "coverage",
  ".turbo",
  ".vite",
]);
const NEVER_PACKED_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "pnpm-workspace.yaml",
]);

function shouldBePacked(file: string): boolean {
  const segments = file.split("/");
  const base = segments.at(-1) ?? "";
  return (
    file !== "recipes/tsconfig.json" &&
    file !== "recipes/shims.d.ts" &&
    file !== "templates/go/README.md" &&
    !segments.includes(".cursor") &&
    !segments.some((segment) => NEVER_PACKED_SEGMENTS.has(segment)) &&
    !NEVER_PACKED_FILES.has(base) &&
    !base.endsWith(".tsbuildinfo")
  );
}

/** Every git-tracked template/recipe file must ship (dotfiles npm strips ship under their packed name). */
function verifyTarballContents(tarballPath: string): string[] {
  const packed = new Set(
    execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf-8" })
      .split("\n")
      .map((line) => line.replace(/^package\//, "")),
  );
  const tracked = execFileSync("git", ["ls-files", "templates", "recipes"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean)
    .filter(shouldBePacked);

  const errors: string[] = [];
  if (!packed.has("dist/index.js")) errors.push("tarball is missing dist/index.js");
  for (const readme of ["README.md", "README_VI.md", "README_CN.md"]) {
    if (!packed.has(readme)) errors.push(`tarball is missing ${readme}`);
  }
  if (!packed.has("schema/zealakit.schema.json")) {
    errors.push("tarball is missing schema/zealakit.schema.json");
  }
  if (packed.has("README_DEV.md")) errors.push("tarball must not include README_DEV.md");
  for (const file of tracked) {
    const base = path.posix.basename(file);
    const expected = PACKED_DOTFILES[base]
      ? path.posix.join(path.posix.dirname(file), PACKED_DOTFILES[base])
      : file;
    if (!packed.has(expected)) errors.push(`tarball is missing ${expected}`);
  }
  for (const file of packed) {
    if (/^(src|scripts|tests|monitor)\//.test(file)) errors.push(`tarball must not ship ${file}`);
  }
  // The npm registry rejects tarballs containing symlinks (HTTP 415).
  const symlinks = execFileSync("tar", ["-tvzf", tarballPath], { encoding: "utf-8" })
    .split("\n")
    .filter((line) => line.startsWith("l"));
  for (const line of symlinks) {
    errors.push(`tarball must not contain symlinks: ${line.split(/\s+/).slice(-3).join(" ")}`);
  }
  return errors;
}

const expectExit = (result: CommandResult, ok: boolean): string[] =>
  (result.exitCode === 0) === ok
    ? []
    : [`expected ${ok ? "success" : "failure"}, got exit ${result.exitCode}\n${result.output}`];

const expectFiles = (appDir: string | undefined, files: string[]): string[] =>
  files
    .filter((file) => !appDir || !fs.existsSync(path.join(appDir, file)))
    .map((f) => `${f} missing`);

const expectNoApp = (appDir: string | undefined): string[] =>
  appDir && fs.existsSync(appDir) && fs.readdirSync(appDir).length > 0
    ? ["project directory should not be created"]
    : [];

const SMOKE_CASES: SmokeCase[] = [
  {
    name: "--version matches package.json",
    args: ["--version"],
    check: (result) => {
      const { version } = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"),
      ) as { version: string };
      return result.output.trim() === version ? [] : [`got "${result.output.trim()}"`];
    },
  },
  {
    name: "info --json prints only JSON",
    args: ["info", "--json"],
    check: (result) => {
      try {
        const info = JSON.parse(result.output) as {
          schemaVersion: number;
          command: string;
          data: { templates: unknown[]; recipes: unknown[] };
        };
        return [
          ...expectExit(result, true),
          ...(info.schemaVersion === 4 && info.command === "info"
            ? []
            : ["unexpected info envelope"]),
          ...(info.data.templates.length > 0 && info.data.recipes.length > 0
            ? []
            : ["empty metadata"]),
        ];
      } catch (error) {
        return [`stdout/stderr is not pure JSON: ${(error as Error).message}`];
      }
    },
  },
  {
    name: "create --discover --json questions",
    args: ["create", "--discover", "--json"],
    input: JSON.stringify({ schemaVersion: 1, operation: "questions", answers: {} }),
    check: (result) => {
      try {
        const response = JSON.parse(result.output) as {
          schemaVersion: number;
          ok: boolean;
          operation: string;
        };
        return [
          ...expectExit(result, true),
          ...(response.schemaVersion === 1 &&
          response.ok === true &&
          response.operation === "questions"
            ? []
            : ["unexpected Discovery response"]),
        ];
      } catch (error) {
        return [`stdout is not pure JSON: ${(error as Error).message}`];
      }
    },
  },
  {
    name: "create --discover --json scaffold",
    args: ["create", "--discover", "--json"],
    appDirName: "smoke-json",
    input: JSON.stringify({
      schemaVersion: 1,
      operation: "scaffold",
      selection: { templateId: "vite-react", recipeIds: [] },
      project: { name: "smoke-json" },
      confirmation: { confirmed: true },
    }),
    check: (result, appDir) => {
      try {
        const response = JSON.parse(result.output) as { ok: boolean; operation: string };
        return [
          ...expectExit(result, true),
          ...(response.ok === true && response.operation === "scaffold"
            ? []
            : ["unexpected scaffold response"]),
          ...expectFiles(appDir, ["package.json", "AGENTS.md"]),
        ];
      } catch (error) {
        return [`stdout is not pure JSON: ${(error as Error).message}`];
      }
    },
  },
  {
    name: "--dry-run previews without writing",
    args: ["create", "smoke-dry-run", "-t", "vite-react", "-w", "biome", "--dry-run"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectNoApp(appDir),
      ...(/Generation Preview/.test(result.output) ? [] : ["missing preview header"]),
      ...(/No files were written/.test(result.output) ? [] : ["missing no-write notice"]),
    ],
  },
  {
    name: "vite-react + biome,zustand,hookform-zod,kyjs",
    args: [
      "create",
      "smoke-client",
      "-t",
      "vite-react",
      "-w",
      "biome,zustand,hookform-zod,kyjs",
      "-y",
    ],
    check: (result, appDir) => {
      const errors = [
        ...expectExit(result, true),
        ...expectFiles(appDir, [".gitignore", "biome.json", "src/configs/i18n.ts", "AGENTS.md"]),
      ];
      const cursor = appDir && path.join(appDir, ".cursor");
      if (!cursor || !fs.existsSync(cursor) || fs.readlinkSync(cursor) !== ".agents") {
        errors.push(".cursor should be a symlink to .agents");
      }
      if (appDir && !fs.existsSync(path.join(appDir, "zealakit.json"))) {
        errors.push("zealakit.json should be written into the project");
      }
      if (appDir && fs.existsSync(path.join(appDir, "_gitignore"))) {
        errors.push("_gitignore should be renamed to .gitignore");
      }
      return errors;
    },
  },
  {
    name: "stdlib-api + postgres",
    args: ["create", "smoke-go-postgres", "-t", "stdlib-api", "-w", "postgres", "-y"],
    check: (result, appDir) => {
      const errors = [
        ...expectExit(result, true),
        ...expectFiles(appDir, [
          "go.mod",
          "internal/infrastructure/database/postgres.go",
          "internal/infrastructure/database/postgres_test.go",
        ]),
      ];
      if (appDir) {
        const goModPath = path.join(appDir, "go.mod");
        if (fs.existsSync(goModPath)) {
          const goMod = fs.readFileSync(goModPath, "utf-8");
          if (!goMod.includes("github.com/jackc/pgx/v5 v5.7.4")) {
            errors.push("go.mod should require pgx");
          }
        }
        if (fs.existsSync(path.join(appDir, "package.json"))) {
          errors.push("Go project must not contain package.json");
        }
      }
      return errors;
    },
  },
  {
    name: "vite-svelte + biome,storybook",
    args: ["create", "smoke-svelte", "-t", "vite-svelte", "-w", "biome,storybook", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectFiles(appDir, [
        ".gitignore",
        "svelte.config.js",
        "src/app.html",
        "src/routes/+layout.svelte",
        "src/configs/i18n.svelte.ts",
        "src/assets/locales/en/common.json",
        "src/assets/locales/vi/common.json",
        "src/features/feature-a/list.svelte",
        "biome.json",
        ".storybook/main.ts",
        "AGENTS.md",
      ]),
    ],
  },
  {
    name: "nuxt + shadcn-vue,pinia",
    args: ["create", "smoke-nuxt", "-t", "nuxt", "-w", "shadcn-vue,pinia", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectFiles(appDir, [".gitignore", "app/components/ui/button/Button.vue"]),
    ],
  },
  {
    name: "nest + type-orm prints start:dev",
    args: ["create", "smoke-nest", "-t", "nest", "-w", "type-orm,biome", "-y", "--pm", "npm"],
    check: (result) => [
      ...expectExit(result, true),
      ...(result.output.includes("npm run start:dev") ? [] : ["should print npm run start:dev"]),
    ],
  },
  {
    name: "--pm pnpm adapts next steps",
    args: ["create", "smoke-pnpm", "-t", "nest", "-y", "--pm", "pnpm"],
    check: (result) => [
      ...expectExit(result, true),
      ...(result.output.includes("pnpm install") && result.output.includes("pnpm start:dev")
        ? []
        : ["should print pnpm install and pnpm start:dev"]),
    ],
  },
  {
    name: "fastapi-api + sqlalchemy,alembic",
    args: ["create", "smoke-py", "-t", "fastapi-api", "-w", "sqlalchemy,alembic", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectFiles(appDir, [
        "pyproject.toml",
        ".gitignore",
        "alembic.ini",
        "src/app/main.py",
        "zealakit.json",
      ]),
      ...(result.output.includes("uv sync") ? [] : ["should print uv sync"]),
    ],
  },
  {
    name: "mcp answers initialize and tools/list",
    args: ["mcp", "--root", "."],
    input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    check: (result) => [
      ...expectExit(result, true),
      ...(result.output.includes('"name":"zealakit"') && result.output.includes('"list_templates"')
        ? []
        : ["mcp server did not answer initialize/tools/list"]),
    ],
  },
  {
    name: "the removed root scaffold form is rejected",
    args: ["smoke-root", "-t", "vite-react", "-y"],
    check: (result, appDir) => [
      ...(result.exitCode === 2 ? [] : [`expected exit 2, got ${result.exitCode}`]),
      ...expectNoApp(appDir),
    ],
  },
  {
    name: "linter conflict is rejected",
    args: ["create", "smoke-conflict", "-t", "vite-react", "-w", "biome,eslint", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, false),
      ...expectNoApp(appDir),
      ...(/conflict/i.test(result.output) ? [] : ["output should mention conflict"]),
    ],
  },
  {
    name: "vue-only recipe on next is rejected before writing files",
    args: ["create", "smoke-next-pinia", "-t", "next", "-w", "pinia", "-y"],
    check: (result, appDir) => [...expectExit(result, false), ...expectNoApp(appDir)],
  },
];

/** Installs nothing new: uses the already-installed tarball to run and type-check `zealakit/api`. */
async function verifyPublishedApi(): Promise<string[]> {
  const dir = path.join(INSTALL_DIR, "api-check");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "check.mjs"),
    `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createZealakit, goEcosystem, nodeEcosystem, ScaffoldValidationError } from "zealakit/api";

const zealakit = createZealakit({ ecosystems: [nodeEcosystem, goEcosystem] });
assert.ok(zealakit.metadata.getTemplates().length > 0);
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-api-"));
const config = { projectName: "api-app", templateId: "vite-react", recipeIds: ["biome"] };
assert.equal(zealakit.scaffold.plan(config, { cwd }).blockers.length, 0);
const created = await zealakit.scaffold.create(config, { cwd });
assert.ok(fs.existsSync(path.join(created.outputDirectory, "zealakit.json")));
await assert.rejects(() => zealakit.scaffold.create(config, { cwd }), ScaffoldValidationError);
const added = zealakit.project.planAdd(created.outputDirectory, ["zustand"]);
assert.deepEqual(added.blockers, []);
assert.ok(zealakit.project.check(created.outputDirectory).isZealakitProject);
fs.rmSync(cwd, { recursive: true, force: true });
console.log("api ok");
`,
  );
  fs.writeFileSync(
    path.join(dir, "check.ts"),
    `import { createZealakit, nodeEcosystem, type Zealakit, type ScaffoldConfig } from "zealakit/api";

const zealakit: Zealakit = createZealakit({ ecosystems: [nodeEcosystem] });
const config: ScaffoldConfig = { projectName: "x", templateId: "vite-react", recipeIds: [] };
const plan = zealakit.scaffold.plan(config);
const blockers: string[] = plan.blockers;
const added = zealakit.project.planAdd(".", ["zustand"]);
const kinds: Array<"create" | "modify" | "conflict"> = added.changes.map((change) => change.kind);
export { blockers, kinds };
`,
  );
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        target: "es2022",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      files: ["check.ts"],
    }),
  );

  const errors: string[] = [];
  const runResult = await run(process.execPath, [path.join(dir, "check.mjs")], dir);
  if (runResult.exitCode !== 0 || !runResult.output.includes("api ok")) {
    errors.push(`runtime check failed:\n${runResult.output.slice(-800)}`);
  }
  const tsc = path.join(PROJECT_ROOT, "node_modules", ".bin", "tsc");
  const typeResult = await run(tsc, ["-p", path.join(dir, "tsconfig.json")], dir);
  if (typeResult.exitCode !== 0) {
    errors.push(`type check failed:\n${typeResult.output.slice(-800)}`);
  }
  return errors;
}

async function main(): Promise<void> {
  let tarballPath: string | undefined;
  try {
    tarballPath = await packCli();
    console.log(dim(`→ Tarball: ${path.basename(tarballPath)}`));

    const results: { name: string; errors: string[] }[] = [
      { name: "tarball contents", errors: verifyTarballContents(tarballPath) },
    ];

    console.log(dim("→ Installing tarball once..."));
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
    fs.mkdirSync(APPS_DIR, { recursive: true });
    await runOrThrow(
      "npm",
      ["install", "--prefix", INSTALL_DIR, "--no-audit", "--no-fund", tarballPath],
      WORK_DIR,
    );
    const bin = path.join(INSTALL_DIR, "node_modules/.bin/zealakit");

    console.log(dim("→ Running smoke cases...\n"));
    results.push(
      ...(await Promise.all(
        SMOKE_CASES.map(async (smoke) => {
          const appName =
            smoke.appDirName ??
            (smoke.args.includes("--json") || smoke.args[1]?.startsWith("-")
              ? undefined
              : smoke.args[1]);
          const result = await run(bin, smoke.args, APPS_DIR, smoke.input);
          const appDir = appName ? path.join(APPS_DIR, appName) : undefined;
          return { name: smoke.name, errors: smoke.check(result, appDir) };
        }),
      )),
    );

    results.push({ name: "zealakit/api from the tarball", errors: await verifyPublishedApi() });

    for (const { name, errors } of results) {
      console.log(`${errors.length === 0 ? green("✔") : red("✖")} ${name}`);
      for (const error of errors) console.log(`  ${red("→")} ${error}`);
    }

    const failed = results.filter((r) => r.errors.length > 0).length;
    console.log(
      failed === 0 ? green(`\nAll ${results.length} checks passed.`) : red(`\n${failed} failed.`),
    );
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    if (tarballPath) fs.rmSync(tarballPath, { force: true });
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(red(`\nFatal error: ${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
