import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACKED_DOTFILES } from "@zealakit/core";

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
  check: (result: CommandResult, appDir: string | undefined) => string[];
};

const color = (code: number) => (text: string) => `\x1b[${code}m${text}\x1b[0m`;
const green = color(32);
const red = color(31);
const dim = color(2);

function run(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    .filter((line) => line.endsWith(".tgz"))
    .pop();
  if (!tarballPath) {
    throw new Error("Could not determine tarball path from pnpm pack output.");
  }
  return path.resolve(PROJECT_ROOT, tarballPath);
}

const NEVER_PACKED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  ".next",
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
    !file.startsWith("templates/go/") &&
    !file.startsWith("recipes/go/") &&
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
        const info = JSON.parse(result.output) as { templates: unknown[]; recipes: unknown[] };
        return [
          ...expectExit(result, true),
          ...(info.templates.length > 0 && info.recipes.length > 0 ? [] : ["empty metadata"]),
        ];
      } catch (error) {
        return [`stdout/stderr is not pure JSON: ${(error as Error).message}`];
      }
    },
  },
  {
    name: "--dry-run previews without writing",
    args: ["smoke-dry-run", "-t", "vite-react", "-w", "biome", "--dry-run"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectNoApp(appDir),
      ...(/Generation Preview/.test(result.output) ? [] : ["missing preview header"]),
      ...(/No files were written/.test(result.output) ? [] : ["missing no-write notice"]),
    ],
  },
  {
    name: "vite-react + biome,zustand,hookform-zod,kyjs",
    args: ["smoke-client", "-t", "vite-react", "-w", "biome,zustand,hookform-zod,kyjs", "-y"],
    check: (result, appDir) => {
      const errors = [
        ...expectExit(result, true),
        ...expectFiles(appDir, [".gitignore", "biome.json", "src/configs/i18n.ts", "AGENTS.md"]),
      ];
      const cursor = appDir && path.join(appDir, ".cursor");
      if (!cursor || !fs.existsSync(cursor) || fs.readlinkSync(cursor) !== ".agents") {
        errors.push(".cursor should be a symlink to .agents");
      }
      if (appDir && fs.existsSync(path.join(appDir, "_gitignore"))) {
        errors.push("_gitignore should be renamed to .gitignore");
      }
      return errors;
    },
  },
  {
    name: "nuxt + shadcn-vue,pinia",
    args: ["smoke-nuxt", "-t", "nuxt", "-w", "shadcn-vue,pinia", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, true),
      ...expectFiles(appDir, [".gitignore", "app/components/ui/button/Button.vue"]),
    ],
  },
  {
    name: "nest + type-orm prints start:dev",
    args: ["smoke-nest", "-t", "nest", "-w", "type-orm,biome", "-y"],
    check: (result) => [
      ...expectExit(result, true),
      ...(result.output.includes("npm run start:dev") ? [] : ["should print npm run start:dev"]),
    ],
  },
  {
    name: "linter conflict is rejected",
    args: ["smoke-conflict", "-t", "vite-react", "-w", "biome,eslint", "-y"],
    check: (result, appDir) => [
      ...expectExit(result, false),
      ...expectNoApp(appDir),
      ...(/conflict/i.test(result.output) ? [] : ["output should mention conflict"]),
    ],
  },
  {
    name: "vue-only recipe on next is rejected before writing files",
    args: ["smoke-next-pinia", "-t", "next", "-w", "pinia", "-y"],
    check: (result, appDir) => [...expectExit(result, false), ...expectNoApp(appDir)],
  },
];

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
          const appName = smoke.args[0]?.startsWith("-") ? undefined : smoke.args[0];
          const result = await run(bin, smoke.args, APPS_DIR);
          const appDir = appName ? path.join(APPS_DIR, appName) : undefined;
          return { name: smoke.name, errors: smoke.check(result, appDir) };
        }),
      )),
    );

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
