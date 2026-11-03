import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const E2E_WORK_DIR = path.join(os.tmpdir(), "zealakit-e2e-tests");

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
}

interface TestCaseResult {
  name: string;
  passed: boolean;
  errors: string[];
}

function log(message: string): void {
  console.log(message);
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        output: `${stdout}\n${stderr}`,
      });
    });
  });
}

async function runNpxTarball(
  tarballPath: string,
  projectArgs: string[],
  cwd: string,
): Promise<CommandResult> {
  return runCommand("npx", ["--yes", `--package=${tarballPath}`, "zealakit", ...projectArgs], cwd);
}

function assert(condition: boolean, message: string, errors: string[]): void {
  if (!condition) {
    errors.push(message);
  }
}

function readPackageJson(projectDir: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(projectDir, "package.json"), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function pathExists(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

async function buildCli(): Promise<void> {
  log(dim("→ Building CLI (npm run build)..."));
  const result = await runCommand("npm", ["run", "build"], PROJECT_ROOT);
  if (result.exitCode !== 0) {
    throw new Error(`Build failed:\n${result.output}`);
  }
}

async function packCli(): Promise<string> {
  log(dim("→ Packing CLI (npm pack)..."));
  const result = await runCommand("npm", ["pack", "--silent"], PROJECT_ROOT);
  if (result.exitCode !== 0) {
    throw new Error(`npm pack failed:\n${result.output}`);
  }

  const tarballName = result.stdout.trim().split("\n").pop()?.trim();
  if (!tarballName) {
    throw new Error("Could not determine tarball name from npm pack output.");
  }

  const tarballPath = path.join(PROJECT_ROOT, tarballName);
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Tarball not found at ${tarballPath}`);
  }

  return tarballPath;
}

function verifyTarballContents(tarballPath: string): void {
  log(dim("→ Verifying tarball contents..."));
  const listing = execSync(`tar -tzf "${tarballPath}"`, { encoding: "utf-8" });
  const requiredPrefixes = [
    "package/dist/",
    "package/templates/vite-react/",
    "package/templates/vite-vue/",
    "package/templates/nuxt/",
    "package/recipes/",
    "package/recipes/biome/overlays/vite-react/biome.json",
    "package/recipes/biome/overlays/vite-vue/biome.json",
    "package/recipes/biome/overlays/nuxt/biome.json",
    "package/recipes/biome/overlays/next/biome.json",
    "package/recipes/biome/overlays/nest/biome.json",
    "package/recipes/biome/overlays/hono/biome.json",
    "package/recipes/eslint/overlays/vite-react/eslint.config.js",
    "package/recipes/eslint/overlays/vite-vue/eslint.config.js",
    "package/recipes/eslint/overlays/nuxt/eslint.config.js",
    "package/recipes/eslint/overlays/next/eslint.config.js",
    "package/recipes/eslint/overlays/nest/eslint.config.js",
    "package/recipes/eslint/overlays/hono/eslint.config.js",
    "package/recipes/hookform-zod/.agents/skills/hookform-zod/SKILL.md",
    "package/recipes/vee-validate-zod/.agents/skills/vee-validate-zod/SKILL.md",
    "package/recipes/antd/overlays/vite-react/src/app/antd-theme-provider.tsx",
    "package/recipes/antd/overlays/vite-react/src/configs/theme.ts",
    "package/recipes/antd/overlays/next/src/app/antd-theme-provider.tsx",
    "package/recipes/antd/overlays/next/src/configs/theme.ts",
    "package/recipes/antd/overlays/vite-vue/.gitkeep",
    "package/recipes/antd/overlays/nuxt/.gitkeep",
    "package/recipes/client-shared-pieces/overlays/vite-react/src/configs/i18n.ts",
    "package/recipes/client-shared-pieces/overlays/vite-react/src/hooks/use-mobile-view.ts",
    "package/recipes/client-shared-pieces/overlays/next/src/hooks/use-mobile-view.ts",
    "package/recipes/client-shared-pieces/overlays/vite-vue/src/configs/i18n.ts",
    "package/recipes/client-shared-pieces/overlays/nuxt/.gitkeep",
    "package/recipes/client-shared-pieces/shared/src/lib/utils/api.ts",
    "package/recipes/antd/shared/src/components/ui/index.ts",
    "package/recipes/mui/overlays/vite-react/src/app/mui-theme-provider.tsx",
    "package/recipes/mui/overlays/next/src/app/mui-theme-provider.tsx",
    "package/recipes/mui/overlays/next/src/configs/theme.ts",
    "package/recipes/mui/overlays/vite-vue/.gitkeep",
    "package/recipes/mui/overlays/nuxt/.gitkeep",
    "package/recipes/mui/shared/src/components/ui/index.ts",
    "package/recipes/shadcn-ui/overlays/vite-react/src/styles/globals.css",
    "package/recipes/shadcn-ui/overlays/next/src/app/globals.css",
    "package/recipes/shadcn-ui/overlays/next/components.json",
    "package/recipes/shadcn-ui/overlays/vite-vue/.gitkeep",
    "package/recipes/shadcn-ui/overlays/nuxt/.gitkeep",
    "package/recipes/shadcn-ui/shared/src/components/ui/index.ts",
    "package/recipes/shadcn-ui/overlays/vite-react/components.json",
    "package/recipes/shadcn-vue/overlays/vite-vue/components.json",
    "package/recipes/shadcn-vue/overlays/vite-vue/src/styles/globals.css",
    "package/recipes/shadcn-vue/overlays/nuxt/components.json",
    "package/recipes/shadcn-vue/overlays/nuxt/app/assets/css/main.css",
    "package/recipes/shadcn-vue/shared/src/components/ui/button/index.ts",
    "package/recipes/shadcn-vue/.agents/skills/shadcn-vue/SKILL.md",
    "package/recipes/nuxt-ui/overlays/vite-vue/vite.config.ts",
    "package/recipes/nuxt-ui/overlays/vite-vue/src/styles/globals.css",
    "package/recipes/nuxt-ui/overlays/nuxt/app/app.vue",
    "package/recipes/nuxt-ui/overlays/nuxt/app/assets/css/main.css",
    "package/recipes/nuxt-ui/.agents/skills/nuxt-ui/SKILL.md",
    "package/recipes/storybook/overlays/vite-react/.storybook/main.ts",
    "package/recipes/storybook/overlays/vite-vue/.storybook/main.ts",
    "package/recipes/storybook/overlays/nuxt/.storybook/main.ts",
    "package/recipes/storybook/overlays/next/.storybook/main.ts",
    "package/recipes/storybook/.agents/skills/storybook/SKILL.md",
    "package/templates/next/package.json",
    "package/templates/nuxt/package.json",
    "package/templates/nuxt/i18n/locales/en.ts",
    "package/templates/nuxt/i18n/locales/vi.ts",
    "package/templates/nuxt/.agents/skills/nuxt/SKILL.md",
    "package/templates/nest/package.json",
    "package/templates/nest/.agents/skills/structure-ddd/SKILL.md",
    "package/templates/hono/package.json",
    "package/templates/hono/.agents/skills/structure-ddd/SKILL.md",
    "package/templates/hono/.agents/skills/hono/SKILL.md",
    "package/recipes/type-orm/overlays/nest/src/infrastructure/persistence/typeorm/typeorm.module.ts",
    "package/recipes/type-orm/overlays/hono/src/infrastructure/persistence/typeorm/typeorm.data-source.ts",
    "package/recipes/mikro-orm/overlays/nest/src/infrastructure/persistence/mikro-orm/mikro-orm.module.ts",
    "package/recipes/mikro-orm/overlays/hono/src/infrastructure/persistence/mikro-orm/mikro-orm.bootstrap.ts",
    "package/recipes/drizzle-orm/overlays/nest/src/infrastructure/persistence/drizzle/drizzle.module.ts",
    "package/recipes/drizzle-orm/overlays/hono/src/infrastructure/persistence/drizzle/drizzle.bootstrap.ts",
    "package/recipes/type-orm/.agents/skills/type-orm/SKILL.md",
    "package/recipes/mikro-orm/.agents/skills/mikro-orm/SKILL.md",
    "package/recipes/drizzle-orm/.agents/skills/drizzle-orm/SKILL.md",
  ];

  for (const prefix of requiredPrefixes) {
    if (!listing.includes(prefix)) {
      throw new Error(`Tarball is missing required path prefix: ${prefix}`);
    }
  }
}

async function testCase1ClientPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 1: client pass (biome + zustand + hookform-zod + kyjs)";
  const errors: string[] = [];
  const appName = "test-client";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "biome,zustand,hookform-zod,kyjs", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(pathExists(appDir), `Directory ${appName}/ was not created`, errors);
  assert(
    pathExists(path.join(appDir, "src/lib/utils/api.ts")),
    "default client-shared-pieces recipe should copy lib/utils/api.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/utils/index.ts")),
    "default client-shared-pieces recipe should copy lib/utils/index.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/constants/index.ts")),
    "default client-shared-pieces recipe should copy lib/constants",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/hooks/use-mobile-view.ts")),
    "client-shared-pieces vite-react overlay should copy hooks",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/layouts/console-layout/index.ts")),
    "default client-shared-pieces recipe should copy layouts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/i18n.ts")),
    "client-shared-pieces vite-react overlay should copy configs/i18n.ts",
    errors,
  );
  if (pathExists(path.join(appDir, "src/main.tsx"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.tsx"), "utf-8");
    assert(
      main.includes('import "./configs/i18n";'),
      "client-shared-pieces should wire configs/i18n.ts into main.tsx",
      errors,
    );
  }
  assert(
    pathExists(path.join(appDir, "src/lib/schemas/example.schema.ts")),
    "example.schema.ts should exist",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/hookform-zod/SKILL.md")),
    "hookform-zod recipe should copy the forms skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/rules/hookform-zod.mdc")),
    "hookform-zod recipe should copy the forms rule",
    errors,
  );
  {
    const cursorPath = path.join(appDir, ".cursor");
    assert(pathExists(cursorPath), "scaffolded app should have .cursor", errors);
    if (pathExists(cursorPath)) {
      assert(
        fs.lstatSync(cursorPath).isSymbolicLink(),
        ".cursor should be a symlink to .agents",
        errors,
      );
      assert(
        fs.readlinkSync(cursorPath) === ".agents",
        ".cursor symlink target should be .agents",
        errors,
      );
      assert(
        pathExists(path.join(appDir, ".cursor/skills/hookform-zod/SKILL.md")),
        ".cursor symlink should resolve skills",
        errors,
      );
    }
  }
  assert(
    !pathExists(path.join(appDir, ".agents/skills/project-structure/forms.md")),
    "forms.md should not live under project-structure",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "scaffold")),
    "recipe scaffold/ directory should NOT be copied into the project",
    errors,
  );

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/hookform-zod/SKILL.md"),
      "AGENTS.md should link the hookform-zod skill",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "CLAUDE.md"))) {
    const claude = fs.readFileSync(path.join(appDir, "CLAUDE.md"), "utf-8");
    assert(
      claude.includes(".agents/skills/hookform-zod/SKILL.md"),
      "CLAUDE.md should link the hookform-zod skill",
      errors,
    );
  }
  assert(
    pathExists(path.join(appDir, "src/lib/fetcher/index.ts")),
    "kyjs recipe should copy src/lib/fetcher/index.ts",
    errors,
  );
  assert(pathExists(path.join(appDir, "biome.json")), "biome.json should exist", errors);
  assert(
    !pathExists(path.join(appDir, "overlays")),
    "recipe overlays/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "pnpm-workspace.yaml")),
    "scaffolded app should not ship pnpm-workspace.yaml (package-manager agnostic)",
    errors,
  );

  if (pathExists(path.join(appDir, "biome.json"))) {
    const biomeConfig = JSON.parse(fs.readFileSync(path.join(appDir, "biome.json"), "utf-8")) as {
      root?: boolean;
      linter?: { domains?: Record<string, string> };
    };
    assert(
      biomeConfig.root === undefined,
      "scaffolded biome.json should not set root: false",
      errors,
    );
    assert(
      biomeConfig.linter?.domains?.next === undefined,
      "vite-react biome overlay should not enable the next domain",
      errors,
    );
  }
  assert(
    pathExists(path.join(appDir, "src/stores/something.store.ts")),
    "something.store.ts should exist",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src/stores/something.store.test.ts")),
    "something.store.test.ts should NOT exist",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "vitest.config.ts")),
    "vitest.config.ts should NOT exist",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "eslint.config.js")),
    "eslint.config.js should NOT exist",
    errors,
  );

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;

    assert("zustand" in deps, "package.json should include zustand", errors);
    assert("react-hook-form" in deps, "package.json should include react-hook-form", errors);
    assert("zod" in deps, "package.json should include zod", errors);
    assert(
      "@hookform/resolvers" in deps,
      "package.json should include @hookform/resolvers",
      errors,
    );
    assert("ky" in deps, "package.json should include ky", errors);
    assert(deps.ky === "^2.2.0", `ky version should be ^2.2.0, got ${deps.ky}`, errors);
    assert(!("axios" in deps), "package.json should NOT include axios", errors);
    assert("@biomejs/biome" in devDeps, "package.json should include @biomejs/biome", errors);
    assert(!("antd" in deps), "package.json should NOT include antd", errors);
    assert(!("@mui/material" in deps), "package.json should NOT include @mui/material", errors);
    assert(!("shadcn" in deps), "package.json should NOT include shadcn", errors);
    assert(!("vitest" in devDeps), "package.json should NOT include vitest", errors);
    assert("check" in scripts, 'package.json scripts should include "check"', errors);
    assert(!("test" in scripts), 'package.json scripts should NOT include "test"', errors);
    assert(!("lint" in scripts), 'package.json scripts should NOT include "lint"', errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase2LinterConflict(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 2: linter conflict (biome + eslint)";
  const errors: string[] = [];
  const appName = "test-conflict";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "biome,eslint", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode !== 0, `Expected non-zero exit code, got ${result.exitCode}`, errors);
  assert(
    !pathExists(appDir) || fs.readdirSync(appDir).length === 0,
    `${appName}/ should not exist or should be empty`,
    errors,
  );
  assert(/conflict/i.test(result.output), "Output should mention conflict", errors);
  assert(/linter/i.test(result.output), "Output should mention linter group", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase3EslintStandalone(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 3: eslint standalone pass";
  const errors: string[] = [];
  const appName = "test-eslint";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "eslint", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "eslint.config.js")),
    "eslint.config.js should exist",
    errors,
  );
  assert(!pathExists(path.join(appDir, "biome.json")), "biome.json should NOT exist", errors);
  assert(
    pathExists(path.join(appDir, "src/lib/utils/api.ts")),
    "default client-shared-pieces recipe should copy api.ts",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src/lib/fetcher/index.ts")),
    "fetcher should NOT exist when no fetcher recipe is selected",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, ".agents/skills/hookform-zod/SKILL.md")),
    "hookform-zod skill should NOT exist when the form recipe is not selected",
    errors,
  );

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      !agents.includes(".agents/skills/hookform-zod/SKILL.md"),
      "AGENTS.md should not link hookform-zod when the form recipe is not selected",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    assert("eslint" in devDeps, "package.json should include eslint in devDependencies", errors);
    assert(
      "eslint-plugin-react-hooks" in devDeps,
      "vite-react eslint overlay should add react-hooks plugin",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase4StateConflict(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 4: state conflict (zustand + nanostores)";
  const errors: string[] = [];
  const appName = "test-state-conflict";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "zustand,nanostores", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode !== 0, `Expected non-zero exit code, got ${result.exitCode}`, errors);
  assert(
    !pathExists(appDir) || fs.readdirSync(appDir).length === 0,
    `${appName}/ should not exist or should be empty`,
    errors,
  );
  assert(/conflict/i.test(result.output), "Output should mention conflict", errors);
  assert(/state/i.test(result.output), "Output should mention state group", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase5AxiosPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 5: axios fetcher pass";
  const errors: string[] = [];
  const appName = "test-axios";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "axios", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/lib/fetcher/index.ts")),
    "axios recipe should copy src/lib/fetcher/index.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("axios" in deps, "package.json should include axios", errors);
    assert(deps.axios === "^1.21.0", `axios version should be ^1.21.0, got ${deps.axios}`, errors);
    assert(!("ky" in deps), "package.json should NOT include ky", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase6FetcherConflict(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 6: fetcher conflict (kyjs + axios)";
  const errors: string[] = [];
  const appName = "test-fetcher-conflict";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "kyjs,axios", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode !== 0, `Expected non-zero exit code, got ${result.exitCode}`, errors);
  assert(
    !pathExists(appDir) || fs.readdirSync(appDir).length === 0,
    `${appName}/ should not exist or should be empty`,
    errors,
  );
  assert(/conflict/i.test(result.output), "Output should mention conflict", errors);
  assert(/fetcher/i.test(result.output), "Output should mention fetcher group", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase7AntdPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 7: antd UI kit pass";
  const errors: string[] = [];
  const appName = "test-antd";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "antd", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    !pathExists(path.join(appDir, "overlays")),
    "recipe overlays/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "shared")),
    "recipe shared/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/app/antd-theme-provider.tsx")),
    "vite-react antd overlay should copy src/app/antd-theme-provider.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/index.ts")),
    "antd recipe should copy src/components/ui/index.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "antd recipe should copy src/components/ui/button.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/theme.ts")),
    "antd recipe should copy src/configs/theme.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/antd/SKILL.md")),
    "antd recipe should copy the UI kit skill",
    errors,
  );

  if (pathExists(path.join(appDir, "src/main.tsx"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.tsx"), "utf-8");
    assert(
      main.includes('import { AntdThemeProvider } from "./app/antd-theme-provider"'),
      "main.tsx should import AntdThemeProvider",
      errors,
    );
    assert(
      main.includes("<AntdThemeProvider><App /></AntdThemeProvider>"),
      "main.tsx should wrap <App /> with AntdThemeProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/index.tsx"))) {
    const appIndex = fs.readFileSync(path.join(appDir, "src/app/index.tsx"), "utf-8");
    assert(
      !appIndex.includes("AntdThemeProvider"),
      "app/index.tsx should stay the template entry (no UI provider wrap)",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/antd/SKILL.md"),
      "AGENTS.md should link the antd skill",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("antd" in deps, "package.json should include antd", errors);
    assert(deps.antd === "^6.6.8", `antd version should be ^6.6.8, got ${deps.antd}`, errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase8MuiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 8: mui UI kit pass";
  const errors: string[] = [];
  const appName = "test-mui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "mui", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    !pathExists(path.join(appDir, "overlays")),
    "recipe overlays/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "shared")),
    "recipe shared/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/app/mui-theme-provider.tsx")),
    "vite-react mui overlay should copy src/app/mui-theme-provider.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/index.ts")),
    "mui recipe should copy src/components/ui/index.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "mui recipe should copy src/components/ui/button.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/theme.ts")),
    "mui recipe should copy src/configs/theme.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/mui/SKILL.md")),
    "mui recipe should copy the UI kit skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/material-ui-nextjs/SKILL.md")),
    "mui recipe should copy material-ui-nextjs skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/material-ui-theming/SKILL.md")),
    "mui recipe should copy material-ui-theming skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/material-ui-styling/SKILL.md")),
    "mui recipe should copy material-ui-styling skill",
    errors,
  );

  if (pathExists(path.join(appDir, "src/main.tsx"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.tsx"), "utf-8");
    assert(
      main.includes('import { MuiThemeProvider } from "./app/mui-theme-provider"'),
      "main.tsx should import MuiThemeProvider",
      errors,
    );
    assert(
      main.includes("<MuiThemeProvider><App /></MuiThemeProvider>"),
      "main.tsx should wrap <App /> with MuiThemeProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/index.tsx"))) {
    const appIndex = fs.readFileSync(path.join(appDir, "src/app/index.tsx"), "utf-8");
    assert(
      !appIndex.includes("MuiThemeProvider"),
      "app/index.tsx should stay the template entry (no UI provider wrap)",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/mui/SKILL.md"),
      "AGENTS.md should link the mui skill",
      errors,
    );
    assert(
      agents.includes(".agents/skills/material-ui-nextjs/SKILL.md"),
      "AGENTS.md should link the material-ui-nextjs skill",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("@mui/material" in deps, "package.json should include @mui/material", errors);
    assert(
      deps["@mui/material"] === "^9.5.0",
      `@mui/material version should be ^9.5.0, got ${deps["@mui/material"]}`,
      errors,
    );
    assert("@emotion/react" in deps, "package.json should include @emotion/react", errors);
    assert("@emotion/styled" in deps, "package.json should include @emotion/styled", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase9ShadcnUiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 9: shadcn-ui UI kit pass";
  const errors: string[] = [];
  const appName = "e2e-shadcn-ui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "shadcn-ui", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    !pathExists(path.join(appDir, "overlays")),
    "recipe overlays/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "shared")),
    "recipe shared/ directory should NOT be copied into the project",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/index.ts")),
    "shadcn-ui recipe should copy src/components/ui/index.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "shadcn-ui recipe should copy src/components/ui/button.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/styles/globals.css")),
    "shadcn-ui recipe should overwrite src/styles/globals.css",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "components.json")),
    "shadcn-ui recipe should copy components.json",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/shadcn-ui/SKILL.md")),
    "shadcn-ui recipe should copy the UI kit skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/utils/other.ts")),
    "shadcn-ui recipe should copy src/lib/utils/other.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "src/main.tsx"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.tsx"), "utf-8");
    assert(
      !main.includes("ShadcnThemeProvider"),
      "main.tsx should keep the template entry (no theme provider wrap)",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/lib/utils/index.ts"))) {
    const utilsIndex = fs.readFileSync(path.join(appDir, "src/lib/utils/index.ts"), "utf-8");
    assert(
      utilsIndex.includes('export * from "./api"'),
      "lib/utils/index.ts should keep existing api export",
      errors,
    );
    assert(
      utilsIndex.includes('export * from "./other"'),
      "lib/utils/index.ts should append other export",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "vite.config.ts"))) {
    const viteConfig = fs.readFileSync(path.join(appDir, "vite.config.ts"), "utf-8");
    assert(
      viteConfig.includes("@tailwindcss/vite"),
      "vite.config.ts should include Tailwind Vite plugin",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "components.json"))) {
    const componentsJson = fs.readFileSync(path.join(appDir, "components.json"), "utf-8");
    assert(
      componentsJson.includes('"style": "base-vega"'),
      "components.json should use base-vega style",
      errors,
    );
    assert(
      componentsJson.includes("src/styles/globals.css"),
      "components.json should point CSS at src/styles/globals.css",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/shadcn-ui/SKILL.md"),
      "AGENTS.md should link the shadcn-ui skill",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("shadcn" in deps, "package.json should include shadcn", errors);
    assert(
      deps.shadcn === "^4.23.0",
      `shadcn version should be ^4.23.0, got ${deps.shadcn}`,
      errors,
    );
    assert("tailwindcss" in deps, "package.json should include tailwindcss", errors);
    assert("@base-ui/react" in deps, "package.json should include @base-ui/react", errors);
    assert("cn" in deps, "package.json should include cn", errors);
    assert(
      "@fontsource-variable/inter" in deps,
      "package.json should include @fontsource-variable/inter",
      errors,
    );
    assert(!("radix-ui" in deps), "package.json should NOT include radix-ui", errors);
    assert(!("next-themes" in deps), "package.json should NOT include next-themes", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase10NextShadcnUiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 10: next + shadcn-ui (overlay family: next)";
  const errors: string[] = [];
  const appName = "e2e-next-shadcn-ui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "next", "-w", "shadcn-ui", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "shadcn-ui should copy button for next",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/app/globals.css")),
    "shadcn-ui next overlay should overwrite src/app/globals.css",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "components.json")),
    "shadcn-ui next overlay should copy components.json",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "postcss.config.mjs")),
    "shadcn-ui next overlay should copy postcss.config.mjs",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/utils/index.ts")),
    "shadcn-ui next overlay should provide lib/utils/index.ts",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "pnpm-workspace.yaml")),
    "next scaffold should not ship pnpm-workspace.yaml",
    errors,
  );

  if (pathExists(path.join(appDir, "components.json"))) {
    const componentsJson = fs.readFileSync(path.join(appDir, "components.json"), "utf-8");
    assert(
      componentsJson.includes('"rsc": true'),
      "next components.json should enable rsc",
      errors,
    );
    assert(
      componentsJson.includes("src/app/globals.css"),
      "next components.json should point CSS at src/app/globals.css",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    assert("shadcn" in deps, "package.json should include shadcn", errors);
    assert("@tailwindcss/postcss" in deps, "next overlay should add @tailwindcss/postcss", errors);
    assert(!("@tailwindcss/vite" in deps), "next overlay should NOT add @tailwindcss/vite", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase11NextAntdPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 11: next + antd (overlay family: next)";
  const errors: string[] = [];
  const appName = "e2e-next-antd";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "next", "-w", "antd", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/app/antd-theme-provider.tsx")),
    "antd next overlay should copy antd-theme-provider.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/theme.ts")),
    "antd next overlay should copy theme.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "antd should copy shared button for next",
    errors,
  );

  if (pathExists(path.join(appDir, "src/app/antd-theme-provider.tsx"))) {
    const provider = fs.readFileSync(path.join(appDir, "src/app/antd-theme-provider.tsx"), "utf-8");
    assert(
      provider.includes('"use client"'),
      "Next AntdThemeProvider must be a client component",
      errors,
    );
    assert(
      !provider.includes("@ant-design/nextjs-registry") &&
        !provider.includes('from "@ant-design/nextjs-registry"'),
      "AntdThemeProvider must not import AntdRegistry",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/layout.tsx"))) {
    const rootLayout = fs.readFileSync(path.join(appDir, "src/app/layout.tsx"), "utf-8");
    assert(
      rootLayout.includes("@ant-design/nextjs-registry"),
      "root layout should import AntdRegistry",
      errors,
    );
    assert(
      rootLayout.includes("<AntdRegistry>{children}</AntdRegistry>"),
      "root layout should wrap children with AntdRegistry",
      errors,
    );
    assert(
      !rootLayout.includes("AntdThemeProvider"),
      "root layout should NOT mount AntdThemeProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/[locale]/layout.tsx"))) {
    const localeLayout = fs.readFileSync(path.join(appDir, "src/app/[locale]/layout.tsx"), "utf-8");
    assert(
      localeLayout.includes('from "@/app/antd-theme-provider"'),
      "locale layout should import AntdThemeProvider",
      errors,
    );
    assert(
      localeLayout.includes("<AntdThemeProvider>{children}</AntdThemeProvider>"),
      "locale layout should wrap children with AntdThemeProvider",
      errors,
    );
    assert(
      localeLayout.includes("NextIntlClientProvider"),
      "locale layout should keep NextIntlClientProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    assert("antd" in deps, "package.json should include antd", errors);
    assert(
      "@ant-design/nextjs-registry" in deps,
      "next overlay should add @ant-design/nextjs-registry",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase12NextMuiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 12: next + mui (overlay family: next)";
  const errors: string[] = [];
  const appName = "e2e-next-mui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "next", "-w", "mui", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/app/mui-theme-provider.tsx")),
    "mui next overlay should copy mui-theme-provider.tsx",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/theme.ts")),
    "mui next overlay should copy theme.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button.tsx")),
    "mui should copy shared button for next",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/material-ui-nextjs/SKILL.md")),
    "mui next scaffold should include material-ui-nextjs skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/material-ui-theming/AGENTS.md")),
    "mui next scaffold should include material-ui-theming AGENTS.md",
    errors,
  );

  if (pathExists(path.join(appDir, "src/app/mui-theme-provider.tsx"))) {
    const provider = fs.readFileSync(path.join(appDir, "src/app/mui-theme-provider.tsx"), "utf-8");
    assert(
      provider.includes('"use client"'),
      "Next MuiThemeProvider must be a client component",
      errors,
    );
    assert(
      !provider.includes("@mui/material-nextjs"),
      "MuiThemeProvider must not import AppRouterCacheProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/layout.tsx"))) {
    const rootLayout = fs.readFileSync(path.join(appDir, "src/app/layout.tsx"), "utf-8");
    assert(
      rootLayout.includes("@mui/material-nextjs/v16-appRouter"),
      "root layout should import AppRouterCacheProvider from v16-appRouter",
      errors,
    );
    assert(
      rootLayout.includes("<AppRouterCacheProvider>{children}</AppRouterCacheProvider>"),
      "root layout should wrap children with AppRouterCacheProvider",
      errors,
    );
    assert(
      !rootLayout.includes("MuiThemeProvider"),
      "root layout should NOT mount MuiThemeProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/app/[locale]/layout.tsx"))) {
    const localeLayout = fs.readFileSync(path.join(appDir, "src/app/[locale]/layout.tsx"), "utf-8");
    assert(
      localeLayout.includes('from "@/app/mui-theme-provider"'),
      "locale layout should import MuiThemeProvider",
      errors,
    );
    assert(
      localeLayout.includes("<MuiThemeProvider>{children}</MuiThemeProvider>"),
      "locale layout should wrap children with MuiThemeProvider",
      errors,
    );
    assert(
      localeLayout.includes("NextIntlClientProvider"),
      "locale layout should keep NextIntlClientProvider",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    assert("@mui/material" in deps, "package.json should include @mui/material", errors);
    assert("@mui/material-nextjs" in deps, "next overlay should add @mui/material-nextjs", errors);
    assert("@emotion/cache" in deps, "next overlay should add @emotion/cache", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase14NestBiomePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 14: nest + biome (server overlay)";
  const errors: string[] = [];
  const appName = "e2e-nest-biome";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nest", "-w", "biome", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(pathExists(path.join(appDir, "biome.json")), "biome.json should exist", errors);
  assert(
    pathExists(path.join(appDir, "src/bootstrap/main.ts")),
    "nest template should copy bootstrap/main.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/structure-ddd/SKILL.md")),
    "nest template should ship structure-ddd skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/nestjs/SKILL.md")),
    "nest template should ship nestjs skill",
    errors,
  );
  assert(pathExists(path.join(appDir, "AGENTS.md")), "nest template should ship AGENTS.md", errors);
  assert(
    !pathExists(path.join(appDir, "src/lib/apis/example.ts")),
    "client-shared-pieces should NOT apply on server scope",
    errors,
  );

  if (pathExists(path.join(appDir, "biome.json"))) {
    const biomeConfig = JSON.parse(fs.readFileSync(path.join(appDir, "biome.json"), "utf-8")) as {
      root?: boolean;
      javascript?: { parser?: { unsafeParameterDecoratorsEnabled?: boolean } };
      linter?: { domains?: { next?: string; react?: string } };
    };
    assert(
      biomeConfig.root === undefined,
      "scaffolded nest biome.json should not set root: false",
      errors,
    );
    assert(
      biomeConfig.javascript?.parser?.unsafeParameterDecoratorsEnabled === true,
      "nest biome overlay should enable unsafeParameterDecoratorsEnabled",
      errors,
    );
    assert(
      biomeConfig.linter?.domains?.next === undefined,
      "nest biome overlay should not enable the next domain",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    assert("@nestjs/common" in deps, "package.json should include @nestjs/common", errors);
    assert("@biomejs/biome" in devDeps, "package.json should include @biomejs/biome", errors);
    assert(scripts.check === "biome check .", "should add biome check script", errors);
    assert(
      !("eslint-plugin-react-hooks" in devDeps),
      "nest should NOT get react eslint plugins from biome recipe",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/structure-ddd/SKILL.md"),
      "AGENTS.md should link structure-ddd",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase16NestTypeOrmPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 16: nest + type-orm";
  const errors: string[] = [];
  const appName = "e2e-nest-typeorm";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nest", "-w", "type-orm,biome", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/infrastructure/persistence/typeorm/typeorm.module.ts")),
    "type-orm nest overlay should copy typeorm.module.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/type-orm/SKILL.md")),
    "type-orm recipe should copy skill",
    errors,
  );

  if (pathExists(path.join(appDir, "src/bootstrap/app.module.ts"))) {
    const appModule = fs.readFileSync(path.join(appDir, "src/bootstrap/app.module.ts"), "utf-8");
    assert(
      appModule.includes("TypeormPersistenceModule"),
      "app.module should mention TypeormPersistenceModule",
      errors,
    );
    assert(
      appModule.includes("// import { TypeormPersistenceModule }"),
      "app.module should leave TypeormPersistenceModule import commented until DB is configured",
      errors,
    );
    assert(
      !/imports:\s*\[[^\]]*TypeormPersistenceModule/.test(appModule.replace(/\/\/[^\n]*/g, "")),
      "app.module should not actively register TypeormPersistenceModule",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("typeorm" in deps, "package.json should include typeorm", errors);
    assert("@nestjs/typeorm" in deps, "package.json should include @nestjs/typeorm", errors);
    assert(
      !("better-sqlite3" in deps),
      "type-orm recipe should NOT pin a DB driver like better-sqlite3",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/type-orm/SKILL.md"),
      "AGENTS.md should link type-orm skill",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase17OrmConflict(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 17: orm conflict (type-orm + drizzle-orm)";
  const errors: string[] = [];
  const appName = "e2e-orm-conflict";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nest", "-w", "type-orm,drizzle-orm", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode !== 0, `Expected non-zero exit code, got ${result.exitCode}`, errors);
  assert(
    !pathExists(appDir) || fs.readdirSync(appDir).length === 0,
    `${appName}/ should not exist or should be empty`,
    errors,
  );
  assert(/conflict/i.test(result.output), "Output should mention conflict", errors);
  assert(/orm/i.test(result.output), "Output should mention orm group", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase18NestDrizzlePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 18: nest + drizzle-orm";
  const errors: string[] = [];
  const appName = "e2e-nest-drizzle";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nest", "-w", "drizzle-orm", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/infrastructure/persistence/drizzle/drizzle.module.ts")),
    "drizzle-orm nest overlay should copy drizzle.module.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/infrastructure/persistence/drizzle/drizzle.client.ts")),
    "drizzle-orm nest overlay should copy drizzle.client.ts stub",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "drizzle.config.ts")),
    "drizzle-orm nest overlay should copy drizzle.config.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    assert("drizzle-orm" in deps, "package.json should include drizzle-orm", errors);
    assert(
      !("better-sqlite3" in deps),
      "drizzle-orm recipe should NOT pin a DB driver like better-sqlite3",
      errors,
    );
    assert(
      scripts["db:generate"] === "drizzle-kit generate",
      "should add db:generate script",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase19HonoBiomePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 19: hono + biome (server overlay)";
  const errors: string[] = [];
  const appName = "e2e-hono-biome";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "hono", "-w", "biome", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(pathExists(path.join(appDir, "biome.json")), "biome.json should exist", errors);
  assert(
    pathExists(path.join(appDir, "src/bootstrap/main.ts")),
    "hono template should copy bootstrap/main.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/bootstrap/create-app.ts")),
    "hono template should copy create-app.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/structure-ddd/SKILL.md")),
    "hono template should ship structure-ddd skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/hono/SKILL.md")),
    "hono template should ship hono skill",
    errors,
  );
  assert(pathExists(path.join(appDir, "AGENTS.md")), "hono template should ship AGENTS.md", errors);
  assert(
    !pathExists(path.join(appDir, "src/lib/apis/example.ts")),
    "client-shared-pieces should NOT apply on server scope",
    errors,
  );

  if (pathExists(path.join(appDir, "biome.json"))) {
    const biomeConfig = JSON.parse(fs.readFileSync(path.join(appDir, "biome.json"), "utf-8")) as {
      root?: boolean;
      javascript?: { parser?: { unsafeParameterDecoratorsEnabled?: boolean } };
      linter?: { domains?: { next?: string; react?: string } };
    };
    assert(
      biomeConfig.root === undefined,
      "scaffolded hono biome.json should not set root: false",
      errors,
    );
    assert(
      biomeConfig.javascript?.parser?.unsafeParameterDecoratorsEnabled === undefined,
      "hono biome overlay should not enable Nest decorator parser flags",
      errors,
    );
    assert(
      biomeConfig.linter?.domains?.next === undefined,
      "hono biome overlay should not enable the next domain",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    assert("hono" in deps, "package.json should include hono", errors);
    assert("@hono/node-server" in deps, "package.json should include @hono/node-server", errors);
    assert(!("@nestjs/common" in deps), "hono should NOT include Nest packages", errors);
    assert("@biomejs/biome" in devDeps, "package.json should include @biomejs/biome", errors);
    assert(scripts.check === "biome check .", "should add biome check script", errors);
    assert(
      scripts.dev === "tsx watch src/bootstrap/main.ts",
      "hono should use tsx watch dev",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/hono/SKILL.md"),
      "AGENTS.md should link hono skill",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase20HonoEslintPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 20: hono + eslint (server overlay)";
  const errors: string[] = [];
  const appName = "e2e-hono-eslint";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "hono", "-w", "eslint", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "eslint.config.js")),
    "eslint.config.js should exist",
    errors,
  );
  assert(!pathExists(path.join(appDir, "biome.json")), "biome.json should NOT exist", errors);

  if (pathExists(path.join(appDir, "eslint.config.js"))) {
    const eslintConfig = fs.readFileSync(path.join(appDir, "eslint.config.js"), "utf-8");
    assert(
      eslintConfig.includes("globals.node"),
      "hono eslint overlay should use node globals",
      errors,
    );
    assert(
      !eslintConfig.includes("react-hooks"),
      "hono eslint overlay should not load react-hooks",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    assert("eslint" in devDeps, "package.json should include eslint", errors);
    assert(
      !("eslint-plugin-react-hooks" in devDeps),
      "hono should NOT get react-hooks eslint plugin",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase21HonoDrizzlePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 21: hono + drizzle-orm";
  const errors: string[] = [];
  const appName = "e2e-hono-drizzle";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "hono", "-w", "drizzle-orm,biome", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/infrastructure/persistence/drizzle/drizzle.bootstrap.ts")),
    "drizzle-orm hono overlay should copy drizzle.bootstrap.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/infrastructure/persistence/drizzle/drizzle.client.ts")),
    "drizzle-orm hono overlay should copy drizzle.client.ts stub",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "drizzle.config.ts")),
    "drizzle-orm hono overlay should copy drizzle.config.ts",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src/infrastructure/persistence/drizzle/drizzle.module.ts")),
    "hono drizzle overlay should NOT copy Nest drizzle.module.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "src/bootstrap/container.ts"))) {
    const container = fs.readFileSync(path.join(appDir, "src/bootstrap/container.ts"), "utf-8");
    assert(
      container.includes("createDrizzleClient"),
      "container.ts should reference createDrizzleClient",
      errors,
    );
    assert(
      container.includes("// import { createDrizzleClient }"),
      "container.ts should leave createDrizzleClient import commented until DB is configured",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("drizzle-orm" in deps, "package.json should include drizzle-orm", errors);
    assert("hono" in deps, "package.json should include hono", errors);
    assert(
      !("better-sqlite3" in deps),
      "drizzle-orm recipe should NOT pin a DB driver like better-sqlite3",
      errors,
    );
    assert(!("@nestjs/typeorm" in deps), "hono should NOT get Nest ORM packages", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase15NestEslintPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 15: nest + eslint (server overlay)";
  const errors: string[] = [];
  const appName = "e2e-nest-eslint";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nest", "-w", "eslint", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "eslint.config.js")),
    "eslint.config.js should exist",
    errors,
  );
  assert(!pathExists(path.join(appDir, "biome.json")), "biome.json should NOT exist", errors);

  if (pathExists(path.join(appDir, "eslint.config.js"))) {
    const eslintConfig = fs.readFileSync(path.join(appDir, "eslint.config.js"), "utf-8");
    assert(
      eslintConfig.includes("globals.node"),
      "nest eslint overlay should use node globals",
      errors,
    );
    assert(
      !eslintConfig.includes("eslint-plugin-react-hooks"),
      "nest eslint overlay should not load react-hooks",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    assert("eslint" in devDeps, "package.json should include eslint", errors);
    assert(
      !("eslint-plugin-react-hooks" in devDeps),
      "nest should NOT get react-hooks eslint plugin",
      errors,
    );
    assert(
      !("eslint-plugin-react-refresh" in devDeps),
      "nest should NOT get react-refresh eslint plugin",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase13StorybookPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 13: storybook (+ mui coexistence)";
  const errors: string[] = [];
  const appName = "e2e-storybook";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-react", "-w", "mui,storybook", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, ".storybook/main.ts")),
    "storybook vite overlay should copy .storybook/main.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/storybook/SKILL.md")),
    "storybook recipe should copy skill",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "pnpm-workspace.yaml")),
    "storybook scaffold should not ship pnpm-workspace.yaml",
    errors,
  );

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    assert("@mui/material" in deps, "mui should still install alongside storybook", errors);
    assert("storybook" in devDeps, "package.json should include storybook", errors);
    assert(
      devDeps.storybook === "^10.6.5",
      `storybook version should be ^10.6.5, got ${devDeps.storybook}`,
      errors,
    );
    assert(
      "@storybook/react-vite" in devDeps,
      "vite overlay should add @storybook/react-vite",
      errors,
    );
    assert(scripts.storybook === "storybook dev -p 6006", "should add storybook script", errors);
  }

  if (pathExists(path.join(appDir, "AGENTS.md"))) {
    const agents = fs.readFileSync(path.join(appDir, "AGENTS.md"), "utf-8");
    assert(
      agents.includes(".agents/skills/storybook/SKILL.md"),
      "AGENTS.md should link the storybook skill",
      errors,
    );
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase22ViteVuePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 22: vite-vue pass (biome + nanostores + vee-validate-zod + kyjs + storybook)";
  const errors: string[] = [];
  const appName = "test-vite-vue";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-vue", "-w", "biome,nanostores,vee-validate-zod,kyjs,storybook", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(pathExists(appDir), `Directory ${appName}/ was not created`, errors);
  assert(
    pathExists(path.join(appDir, "src/app/router/index.ts")),
    "vite-vue template should include vue-router composition",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/configs/i18n.ts")),
    "client-shared-pieces vite-vue overlay should copy configs/i18n.ts",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src/hooks")),
    "vite-vue should not get React-style src/hooks from client-shared-pieces",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/app/features/feature-a/composables")),
    "vite-vue template should use feature composables/ (not hooks/)",
    errors,
  );
  if (pathExists(path.join(appDir, "src/main.ts"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.ts"), "utf-8");
    assert(
      main.includes('import { installI18n } from "./configs/i18n";'),
      "client-shared-pieces should wire installI18n into main.ts",
      errors,
    );
    assert(
      main.includes("installI18n(app)"),
      "client-shared-pieces should call installI18n(app)",
      errors,
    );
  }
  assert(
    pathExists(path.join(appDir, "biome.json")),
    "biome vite-vue overlay should copy biome.json",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/schemas/example.schema.ts")),
    "vee-validate-zod should copy example schema",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/vee-validate-zod/SKILL.md")),
    "vee-validate-zod recipe should copy the forms skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".storybook/main.ts")),
    "storybook vite-vue overlay should copy .storybook/main.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    assert("vue" in deps, "package.json should include vue", errors);
    assert("vue-router" in deps, "package.json should include vue-router", errors);
    assert("nanostores" in deps, "package.json should include nanostores", errors);
    assert("@nanostores/vue" in deps, "vite-vue overlay should add @nanostores/vue", errors);
    assert(!("@nanostores/react" in deps), "vite-vue should not add @nanostores/react", errors);
    assert("vee-validate" in deps, "package.json should include vee-validate", errors);
    assert("ky" in deps, "package.json should include ky", errors);
    assert("@storybook/vue3-vite" in devDeps, "vite-vue storybook overlay deps", errors);
    assert(!("react" in deps), "vite-vue scaffold should not include react", errors);
  }

  const reactUiReject = await runNpxTarball(
    tarballPath,
    ["test-vite-vue-antd-reject", "-t", "vite-vue", "-w", "antd", "-y"],
    E2E_WORK_DIR,
  );
  assert(
    reactUiReject.exitCode !== 0,
    "vite-vue + antd should be rejected (ui-react mismatch)",
    errors,
  );

  return { name, passed: errors.length === 0, errors };
}

async function testCase24PiniaPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 24: vite-vue + pinia state pass";
  const errors: string[] = [];
  const appName = "e2e-pinia";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-vue", "-w", "pinia", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/stores/something.store.ts")),
    "pinia recipe should copy store example",
    errors,
  );

  if (pathExists(path.join(appDir, "src/main.ts"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.ts"), "utf-8");
    assert(
      main.includes('import { createPinia } from "pinia";'),
      "main.ts should import createPinia",
      errors,
    );
    assert(main.includes("app.use(createPinia())"), "main.ts should register Pinia", errors);
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("pinia" in deps, "package.json should include pinia", errors);
    assert(deps.pinia === "^4.1.0", `pinia version should be ^4.1.0, got ${deps.pinia}`, errors);
  }

  const zustandReject = await runNpxTarball(
    tarballPath,
    ["e2e-vue-zustand-reject", "-t", "vite-vue", "-w", "zustand", "-y"],
    E2E_WORK_DIR,
  );
  assert(zustandReject.exitCode !== 0, "vite-vue + zustand should be rejected", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase23ShadcnVuePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 23: vite-vue + shadcn-vue UI kit pass";
  const errors: string[] = [];
  const appName = "e2e-shadcn-vue";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-vue", "-w", "shadcn-vue", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "src/components/ui/button/index.ts")),
    "shadcn-vue recipe should copy button index",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/components/ui/button/Button.vue")),
    "shadcn-vue recipe should copy Button.vue",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/styles/globals.css")),
    "shadcn-vue recipe should overwrite src/styles/globals.css",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "components.json")),
    "shadcn-vue recipe should copy components.json",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/shadcn-vue/SKILL.md")),
    "shadcn-vue recipe should copy the UI kit skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/lib/utils/other.ts")),
    "shadcn-vue recipe should copy src/lib/utils/other.ts",
    errors,
  );

  if (pathExists(path.join(appDir, "src/lib/utils/index.ts"))) {
    const utilsIndex = fs.readFileSync(path.join(appDir, "src/lib/utils/index.ts"), "utf-8");
    assert(
      utilsIndex.includes('export * from "./other"'),
      "lib/utils/index.ts should append other export",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "vite.config.ts"))) {
    const viteConfig = fs.readFileSync(path.join(appDir, "vite.config.ts"), "utf-8");
    assert(
      viteConfig.includes("@tailwindcss/vite"),
      "vite.config.ts should include Tailwind Vite plugin",
      errors,
    );
    assert(
      viteConfig.includes("@vitejs/plugin-vue"),
      "vite.config.ts should keep vue plugin",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "components.json"))) {
    const componentsJson = fs.readFileSync(path.join(appDir, "components.json"), "utf-8");
    assert(
      componentsJson.includes('"style": "new-york"'),
      "components.json should use new-york style",
      errors,
    );
    assert(
      componentsJson.includes("src/styles/globals.css"),
      "components.json should point CSS at src/styles/globals.css",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "src/styles/globals.css"))) {
    const css = fs.readFileSync(path.join(appDir, "src/styles/globals.css"), "utf-8");
    assert(css.includes('@import "tailwindcss"'), "globals.css should import tailwindcss", errors);
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("reka-ui" in deps, "package.json should include reka-ui", errors);
    assert("tailwindcss" in deps, "package.json should include tailwindcss", errors);
    assert("@tailwindcss/vite" in deps, "package.json should include @tailwindcss/vite", errors);
    assert("clsx" in deps, "package.json should include clsx", errors);
    assert("tailwind-merge" in deps, "package.json should include tailwind-merge", errors);
    assert("@lucide/vue" in deps, "package.json should include @lucide/vue", errors);
    assert(!("react" in deps), "shadcn-vue scaffold should not include react", errors);
    assert(!("shadcn" in deps), "shadcn-vue should not include react shadcn package", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase25NuxtPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 25: nuxt pass (biome + pinia + vee-validate-zod + kyjs + storybook)";
  const errors: string[] = [];
  const appName = "test-nuxt";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nuxt", "-w", "biome,pinia,vee-validate-zod,kyjs,storybook", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(pathExists(appDir), `Directory ${appName}/ was not created`, errors);
  assert(
    pathExists(path.join(appDir, "app/pages/index.vue")),
    "nuxt template should include app/pages/index.vue",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/layouts/default.vue")),
    "nuxt template should include site layout",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/layouts/entry.vue")),
    "nuxt template should include entry layout",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/layouts/console.vue")),
    "nuxt template should include console layout",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/pages/feature-a/index.vue")),
    "nuxt template should include feature-a pages",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "server/api/health.get.ts")),
    "nuxt template should include health API",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "biome.json")),
    "biome nuxt overlay should copy biome.json",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/stores/something.store.ts")),
    "pinia recipe should land under app/stores",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src")),
    "nuxt scaffold must not keep a top-level src/",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "app/hooks")),
    "nuxt should not get React-style app/hooks from client-shared-pieces",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/lib/schemas/example.schema.ts")),
    "vee-validate-zod should land under app/lib/schemas",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/lib/fetcher/index.ts")),
    "kyjs should land under app/lib/fetcher",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".storybook/main.ts")),
    "storybook nuxt overlay should copy .storybook/main.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/nuxt/SKILL.md")),
    "nuxt template should ship nuxt skill",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "i18n/locales/en.ts")),
    "nuxt template should ship i18n locale loader",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "i18n/locales/en/common.json")),
    "nuxt template should ship locale JSON namespaces",
    errors,
  );

  if (pathExists(path.join(appDir, "nuxt.config.ts"))) {
    const nuxtConfig = fs.readFileSync(path.join(appDir, "nuxt.config.ts"), "utf-8");
    assert(
      nuxtConfig.includes('"@nuxtjs/i18n"'),
      "nuxt.config.ts should register @nuxtjs/i18n",
      errors,
    );
    assert(
      nuxtConfig.includes('"@pinia/nuxt"'),
      "nuxt.config.ts should register @pinia/nuxt",
      errors,
    );
    assert(
      nuxtConfig.includes('storesDirs: ["./app/stores/**"]'),
      "nuxt.config.ts should point Pinia at app/stores",
      errors,
    );
    assert(
      !nuxtConfig.includes('"./src'),
      "nuxt.config.ts should not reference top-level src/",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    assert("nuxt" in deps, "package.json should include nuxt", errors);
    assert("vue" in deps, "package.json should include vue", errors);
    assert("@nuxtjs/i18n" in deps, "package.json should include @nuxtjs/i18n", errors);
    assert("pinia" in deps, "package.json should include pinia", errors);
    assert("@pinia/nuxt" in deps, "nuxt overlay should add @pinia/nuxt", errors);
    assert("vee-validate" in deps, "package.json should include vee-validate", errors);
    assert("ky" in deps, "package.json should include ky", errors);
    assert("@storybook/vue3-vite" in devDeps, "nuxt storybook overlay deps", errors);
    assert(!("react" in deps), "nuxt scaffold should not include react", errors);
  }

  const reactUiReject = await runNpxTarball(
    tarballPath,
    ["test-nuxt-antd-reject", "-t", "nuxt", "-w", "antd", "-y"],
    E2E_WORK_DIR,
  );
  assert(
    reactUiReject.exitCode !== 0,
    "nuxt + antd should be rejected (ui-react mismatch)",
    errors,
  );

  const zustandReject = await runNpxTarball(
    tarballPath,
    ["test-nuxt-zustand-reject", "-t", "nuxt", "-w", "zustand", "-y"],
    E2E_WORK_DIR,
  );
  assert(zustandReject.exitCode !== 0, "nuxt + zustand should be rejected", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase26NuxtShadcnVuePass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 26: nuxt + shadcn-vue UI kit pass";
  const errors: string[] = [];
  const appName = "e2e-nuxt-shadcn-vue";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nuxt", "-w", "shadcn-vue,pinia", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "app/components/ui/button/index.ts")),
    "shadcn-vue recipe should land button index under app/",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/components/ui/button/Button.vue")),
    "shadcn-vue recipe should land Button.vue under app/",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "app/components/ui/index.ts")),
    "shadcn-vue must not ship root ui/index.ts (breaks Nuxt resolvePath)",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src")),
    "nuxt scaffold must not keep a top-level src/",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/assets/css/main.css")),
    "shadcn-vue nuxt overlay should overwrite app/assets/css/main.css",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "components.json")),
    "shadcn-vue recipe should copy components.json",
    errors,
  );

  if (pathExists(path.join(appDir, "app/lib/utils/index.ts"))) {
    const utilsIndex = fs.readFileSync(path.join(appDir, "app/lib/utils/index.ts"), "utf-8");
    assert(
      utilsIndex.includes('export * from "./other"'),
      "app/lib/utils/index.ts should append other export",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "nuxt.config.ts"))) {
    const nuxtConfig = fs.readFileSync(path.join(appDir, "nuxt.config.ts"), "utf-8");
    assert(
      nuxtConfig.includes("@tailwindcss/vite"),
      "nuxt.config.ts should import Tailwind Vite plugin",
      errors,
    );
    assert(
      nuxtConfig.includes('"shadcn-nuxt"'),
      "nuxt.config.ts should register shadcn-nuxt",
      errors,
    );
    assert(
      nuxtConfig.includes('"@pinia/nuxt"'),
      "nuxt.config.ts should still register @pinia/nuxt with shadcn-vue",
      errors,
    );
    assert(
      nuxtConfig.includes('componentDir: "./app/components/ui"'),
      "nuxt.config.ts should configure shadcn componentDir",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "components.json"))) {
    const componentsJson = fs.readFileSync(path.join(appDir, "components.json"), "utf-8");
    assert(
      componentsJson.includes("app/assets/css/main.css"),
      "components.json should point CSS at app/assets/css/main.css",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "app/assets/css/main.css"))) {
    const css = fs.readFileSync(path.join(appDir, "app/assets/css/main.css"), "utf-8");
    assert(css.includes('@import "tailwindcss"'), "main.css should import tailwindcss", errors);
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("reka-ui" in deps, "package.json should include reka-ui", errors);
    assert("tailwindcss" in deps, "package.json should include tailwindcss", errors);
    assert("@tailwindcss/vite" in deps, "package.json should include @tailwindcss/vite", errors);
    assert("shadcn-nuxt" in deps, "package.json should include shadcn-nuxt", errors);
    assert("@pinia/nuxt" in deps, "package.json should include @pinia/nuxt", errors);
    assert(!("react" in deps), "nuxt shadcn-vue scaffold should not include react", errors);
  }

  return { name, passed: errors.length === 0, errors };
}

async function testCase27ViteVueNuxtUiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 27: vite-vue + nuxt-ui UI kit pass";
  const errors: string[] = [];
  const appName = "e2e-vite-vue-nuxt-ui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "vite-vue", "-w", "nuxt-ui,pinia", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "vite.config.ts")),
    "nuxt-ui should overwrite vite.config.ts",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "src/styles/globals.css")),
    "nuxt-ui should overwrite globals.css",
    errors,
  );
  assert(
    pathExists(path.join(appDir, ".agents/skills/nuxt-ui/SKILL.md")),
    "nuxt-ui recipe should copy the UI kit skill",
    errors,
  );

  if (pathExists(path.join(appDir, "vite.config.ts"))) {
    const viteConfig = fs.readFileSync(path.join(appDir, "vite.config.ts"), "utf-8");
    assert(viteConfig.includes("@nuxt/ui/vite"), "vite.config.ts should use @nuxt/ui/vite", errors);
    assert(viteConfig.includes("@vitejs/plugin-vue"), "vite.config.ts should keep vue plugin", errors);
  }

  if (pathExists(path.join(appDir, "src/main.ts"))) {
    const main = fs.readFileSync(path.join(appDir, "src/main.ts"), "utf-8");
    assert(
      main.includes('import ui from "@nuxt/ui/vue-plugin"'),
      "main.ts should import Nuxt UI vue plugin",
      errors,
    );
    assert(main.includes("app.use(ui)"), "main.ts should register Nuxt UI", errors);
    assert(main.includes("app.use(createPinia())"), "main.ts should still register Pinia", errors);
  }

  if (pathExists(path.join(appDir, "src/app/index.vue"))) {
    const appVue = fs.readFileSync(path.join(appDir, "src/app/index.vue"), "utf-8");
    assert(appVue.includes("<UApp>"), "app shell should wrap with UApp", errors);
  }

  if (pathExists(path.join(appDir, "index.html"))) {
    const html = fs.readFileSync(path.join(appDir, "index.html"), "utf-8");
    assert(html.includes('class="isolate"'), "index.html #app should have isolate class", errors);
  }

  if (pathExists(path.join(appDir, "src/styles/globals.css"))) {
    const css = fs.readFileSync(path.join(appDir, "src/styles/globals.css"), "utf-8");
    assert(css.includes('@import "@nuxt/ui"'), "globals.css should import @nuxt/ui", errors);
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    assert("@nuxt/ui" in deps, "package.json should include @nuxt/ui", errors);
    assert("tailwindcss" in deps, "package.json should include tailwindcss", errors);
    assert(
      scripts.build === "vite build && vue-tsc -b --noEmit",
      "build script should run vite before vue-tsc",
      errors,
    );
    assert(!("react" in deps), "nuxt-ui scaffold should not include react", errors);
  }

  const conflict = await runNpxTarball(
    tarballPath,
    ["e2e-vue-ui-conflict", "-t", "vite-vue", "-w", "nuxt-ui,shadcn-vue", "-y"],
    E2E_WORK_DIR,
  );
  assert(conflict.exitCode !== 0, "nuxt-ui + shadcn-vue should be rejected", errors);

  return { name, passed: errors.length === 0, errors };
}

async function testCase28NuxtNuxtUiPass(tarballPath: string): Promise<TestCaseResult> {
  const name = "Test 28: nuxt + nuxt-ui UI kit pass";
  const errors: string[] = [];
  const appName = "e2e-nuxt-nuxt-ui";
  const appDir = path.join(E2E_WORK_DIR, appName);

  const result = await runNpxTarball(
    tarballPath,
    [appName, "-t", "nuxt", "-w", "nuxt-ui,pinia", "-y"],
    E2E_WORK_DIR,
  );

  assert(result.exitCode === 0, `Expected exit code 0, got ${result.exitCode}`, errors);
  assert(
    pathExists(path.join(appDir, "app/app.vue")),
    "nuxt-ui should overwrite app/app.vue",
    errors,
  );
  assert(
    pathExists(path.join(appDir, "app/assets/css/main.css")),
    "nuxt-ui should overwrite app/assets/css/main.css",
    errors,
  );
  assert(
    !pathExists(path.join(appDir, "src")),
    "nuxt scaffold must not keep a top-level src/",
    errors,
  );

  if (pathExists(path.join(appDir, "app/app.vue"))) {
    const appVue = fs.readFileSync(path.join(appDir, "app/app.vue"), "utf-8");
    assert(appVue.includes("<UApp>"), "app.vue should wrap with UApp", errors);
  }

  if (pathExists(path.join(appDir, "nuxt.config.ts"))) {
    const nuxtConfig = fs.readFileSync(path.join(appDir, "nuxt.config.ts"), "utf-8");
    assert(nuxtConfig.includes('"@nuxt/ui"'), "nuxt.config.ts should register @nuxt/ui", errors);
    assert(
      nuxtConfig.includes('"@pinia/nuxt"'),
      "nuxt.config.ts should still register @pinia/nuxt",
      errors,
    );
  }

  if (pathExists(path.join(appDir, "app/assets/css/main.css"))) {
    const css = fs.readFileSync(path.join(appDir, "app/assets/css/main.css"), "utf-8");
    assert(css.includes('@import "@nuxt/ui"'), "main.css should import @nuxt/ui", errors);
  }

  if (pathExists(path.join(appDir, "package.json"))) {
    const pkg = readPackageJson(appDir);
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    assert("@nuxt/ui" in deps, "package.json should include @nuxt/ui", errors);
    assert("tailwindcss" in deps, "package.json should include tailwindcss", errors);
    assert("@pinia/nuxt" in deps, "package.json should include @pinia/nuxt", errors);
    assert(!("react" in deps), "nuxt-ui scaffold should not include react", errors);
  }

  const reactReject = await runNpxTarball(
    tarballPath,
    ["e2e-next-nuxt-ui-reject", "-t", "next", "-w", "nuxt-ui", "-y"],
    E2E_WORK_DIR,
  );
  assert(reactReject.exitCode !== 0, "next + nuxt-ui should be rejected (ui-vue)", errors);

  return { name, passed: errors.length === 0, errors };
}

function printReport(results: TestCaseResult[]): void {
  log(`\n${"=".repeat(60)}`);
  log("E2E Pack Test Report");
  log("=".repeat(60));

  for (const result of results) {
    const icon = result.passed ? green("✔") : red("✖");
    log(`${icon} ${result.name}`);
    if (!result.passed) {
      for (const error of result.errors) {
        log(`  ${red("→")} ${error}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  log("=".repeat(60));
  log(
    passed === total
      ? green(`All ${total} tests passed.`)
      : red(`${passed}/${total} tests passed.`),
  );
  log(`${"=".repeat(60)}\n`);
}

function removeTarball(tarballPath: string | null): void {
  if (tarballPath && fs.existsSync(tarballPath)) {
    fs.rmSync(tarballPath, { force: true });
  }
}

function removeWorkDir(): void {
  if (fs.existsSync(E2E_WORK_DIR)) {
    fs.rmSync(E2E_WORK_DIR, { recursive: true, force: true });
  }
}

function removePackedTarballsInRoot(): void {
  const entries = fs.readdirSync(PROJECT_ROOT);
  for (const entry of entries) {
    if (entry.startsWith("zealakit-") && entry.endsWith(".tgz")) {
      fs.rmSync(path.join(PROJECT_ROOT, entry), { force: true });
    }
  }
}

async function main(): Promise<void> {
  let tarballPath: string | null = null;
  const results: TestCaseResult[] = [];

  try {
    log(dim("\nZealakit E2E Pack Tests\n"));

    removeWorkDir();
    fs.mkdirSync(E2E_WORK_DIR, { recursive: true });

    await buildCli();
    tarballPath = await packCli();
    verifyTarballContents(tarballPath);

    log(dim(`→ Tarball: ${path.basename(tarballPath)}\n`));
    log(dim("→ Running test cases...\n"));

    results.push(await testCase1ClientPass(tarballPath));
    results.push(await testCase2LinterConflict(tarballPath));
    results.push(await testCase3EslintStandalone(tarballPath));
    results.push(await testCase4StateConflict(tarballPath));
    results.push(await testCase5AxiosPass(tarballPath));
    results.push(await testCase6FetcherConflict(tarballPath));
    results.push(await testCase7AntdPass(tarballPath));
    results.push(await testCase8MuiPass(tarballPath));
    results.push(await testCase9ShadcnUiPass(tarballPath));
    results.push(await testCase10NextShadcnUiPass(tarballPath));
    results.push(await testCase11NextAntdPass(tarballPath));
    results.push(await testCase12NextMuiPass(tarballPath));
    results.push(await testCase13StorybookPass(tarballPath));
    results.push(await testCase14NestBiomePass(tarballPath));
    results.push(await testCase15NestEslintPass(tarballPath));
    results.push(await testCase16NestTypeOrmPass(tarballPath));
    results.push(await testCase17OrmConflict(tarballPath));
    results.push(await testCase18NestDrizzlePass(tarballPath));
    results.push(await testCase19HonoBiomePass(tarballPath));
    results.push(await testCase20HonoEslintPass(tarballPath));
    results.push(await testCase21HonoDrizzlePass(tarballPath));
    results.push(await testCase22ViteVuePass(tarballPath));
    results.push(await testCase23ShadcnVuePass(tarballPath));
    results.push(await testCase24PiniaPass(tarballPath));
    results.push(await testCase25NuxtPass(tarballPath));
    results.push(await testCase26NuxtShadcnVuePass(tarballPath));
    results.push(await testCase27ViteVueNuxtUiPass(tarballPath));
    results.push(await testCase28NuxtNuxtUiPass(tarballPath));

    printReport(results);

    const allPassed = results.every((r) => r.passed);
    process.exit(allPassed ? 0 : 1);
  } finally {
    removeTarball(tarballPath);
    removePackedTarballsInRoot();
    removeWorkDir();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(red(`\nFatal error: ${message}\n`));
  removeWorkDir();
  removePackedTarballsInRoot();
  process.exit(1);
});
