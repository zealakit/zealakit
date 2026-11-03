/**
 * Manual npm release for the version in package.json.
 *
 *   pnpm release                 # checks + tests + publish (asks for confirmation)
 *   pnpm release --dry-run       # everything except the actual upload
 *   pnpm release --skip-tests    # skip check/typecheck/test/test:pack
 *   pnpm release --tag next      # override dist-tag (default: prerelease id or "latest")
 *   pnpm release --otp 123456    # npm 2FA code
 *   pnpm release --yes           # no confirmation prompt
 *   pnpm release --allow-dirty   # allow uncommitted changes
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cancel, confirm, isCancel } from "@clack/prompts";
import pc from "picocolors";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Options = {
  dryRun: boolean;
  skipTests: boolean;
  yes: boolean;
  allowDirty: boolean;
  tag?: string;
  otp?: string;
};

function parseArgs(argv: string[]): Options {
  const flagValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    dryRun: argv.includes("--dry-run"),
    skipTests: argv.includes("--skip-tests"),
    yes: argv.includes("--yes") || argv.includes("-y"),
    allowDirty: argv.includes("--allow-dirty"),
    tag: flagValue("--tag"),
    otp: flagValue("--otp"),
  };
}

function abort(message: string): never {
  console.error(pc.red(`✖ ${message}`));
  process.exit(1);
}

function capture(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: PROJECT_ROOT, encoding: "utf-8" });
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function step(label: string, command: string, args: string[]): void {
  console.log(pc.cyan(`\n→ ${label}`));
  const result = spawnSync(command, args, { cwd: PROJECT_ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    abort(`${label} failed.`);
  }
}

/**
 * Every version ever published, including unpublished ones: npm never allows
 * reusing them, but `npm view` reports unpublished versions as 404.
 */
async function fetchUsedVersions(name: string): Promise<Set<string>> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (response.status === 404) {
    return new Set();
  }
  if (!response.ok) {
    abort(`Could not read ${name} from the npm registry (HTTP ${response.status}).`);
  }

  const doc = (await response.json()) as {
    versions?: Record<string, unknown>;
    time?: Record<string, unknown> & { unpublished?: { versions?: string[] } };
  };
  const timestamps = Object.keys(doc.time ?? {}).filter(
    (key) => !["created", "modified", "unpublished"].includes(key),
  );
  return new Set([
    ...Object.keys(doc.versions ?? {}),
    ...timestamps,
    ...(doc.time?.unpublished?.versions ?? []),
  ]);
}

/** `1.0.0-beta.1` → `beta`; stable versions → `latest`. */
function defaultDistTag(version: string): string {
  const prerelease = version.split("-")[1];
  return prerelease ? (prerelease.split(".")[0] ?? "next") : "latest";
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { name, version } = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"),
  ) as { name: string; version: string };
  const tag = options.tag ?? defaultDistTag(version);

  console.log(`${pc.bold(name)}@${pc.green(version)} → dist-tag ${pc.yellow(tag)}`);

  if (!options.allowDirty) {
    const status = capture("git", ["status", "--porcelain"]);
    if (status.ok && status.stdout) {
      abort("Working tree has uncommitted changes (use --allow-dirty to override).");
    }
  }

  if ((await fetchUsedVersions(name)).has(version)) {
    abort(
      `${name}@${version} was already published (possibly unpublished since); npm never reuses versions. Bump "version" in package.json first.`,
    );
  }

  if (!options.dryRun) {
    const whoami = capture("npm", ["whoami"]);
    if (!whoami.ok) {
      abort("Not logged in to npm. Run `npm login` first.");
    }
    console.log(pc.dim(`npm user: ${whoami.stdout}`));
  }

  if (!options.skipTests) {
    step("Biome check", "pnpm", ["check"]);
    step("Typecheck", "pnpm", ["typecheck"]);
    step("Tests", "pnpm", ["test"]);
    step("Pack smoke tests", "pnpm", ["test:pack"]);
  }

  if (!options.dryRun && !options.yes) {
    const answer = await confirm({ message: `Publish ${name}@${version} with tag "${tag}"?` });
    if (isCancel(answer) || !answer) {
      cancel("Publish cancelled.");
      process.exit(0);
    }
  }

  const publishArgs = ["publish", "--access", "public", "--tag", tag];
  if (options.dryRun) publishArgs.push("--dry-run");
  if (options.allowDirty) publishArgs.push("--no-git-checks");
  if (options.otp) publishArgs.push("--otp", options.otp);
  step(options.dryRun ? "Publish (dry run)" : "Publish", "pnpm", publishArgs);

  if (options.dryRun) {
    console.log(pc.green(`\n✔ Dry run OK for ${name}@${version}.`));
    return;
  }

  console.log(pc.green(`\n✔ Published ${name}@${version} (${tag}).`));
  console.log(pc.dim(`  Tag the release: git tag v${version} && git push origin v${version}`));
}

main().catch((error: unknown) => {
  abort(error instanceof Error ? error.message : String(error));
});
