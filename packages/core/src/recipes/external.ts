import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RecipeConfig } from "../types.js";
import { loadRecipeDirectory } from "./data.js";

export type ExternalSource =
  | { kind: "path"; dir: string }
  | { kind: "github"; owner: string; repo: string; subPath: string; ref?: string };

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;
const GITHUB_REF = /^[A-Za-z0-9._/-]+$/;

/** A `-w` entry is external when it names a path or a `github:` source (built-in ids never do). */
export function isExternalRecipeSpec(spec: string): boolean {
  return (
    spec.startsWith("github:") || spec.startsWith(".") || spec.startsWith("/") || spec.includes("/")
  );
}

export type ParsedSpec = { ok: true; source: ExternalSource } | { ok: false; error: string };

export function parseExternalSpec(spec: string, cwd: string): ParsedSpec {
  if (!spec.startsWith("github:")) {
    return { ok: true, source: { kind: "path", dir: path.resolve(cwd, spec) } };
  }
  const [location = "", ...refParts] = spec.slice("github:".length).split("#");
  const ref = refParts.join("#") || undefined;
  const [owner, repo, ...rest] = location.split("/");
  if (!owner || !repo || !GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
    return { ok: false, error: `'${spec}' is not a valid github:owner/repo[/path][#ref] source.` };
  }
  if (rest.some((part) => part === ".." || part === "." || part === "")) {
    return {
      ok: false,
      error: `'${spec}': the path inside the repository may not contain '..' or empty segments.`,
    };
  }
  if (ref !== undefined && (!GITHUB_REF.test(ref) || ref.includes(".."))) {
    return { ok: false, error: `'${spec}': invalid git ref.` };
  }
  return { ok: true, source: { kind: "github", owner, repo, subPath: rest.join("/"), ref } };
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type ResolveExternalOptions = {
  cwd: string;
  /** Where downloaded GitHub tarballs are cached (under the zealakit config dir). */
  cacheDir: string;
  fetch?: FetchLike;
};

export type ResolveExternalResult =
  | { ok: true; recipe: RecipeConfig }
  | { ok: false; errors: string[] };

/**
 * Archive entries that are links, absolute paths, or climb out of the archive.
 * `names` comes from `tar -tzf`, `verbose` from `tar -tvzf` (first column = entry type).
 */
export function unsafeArchiveEntries(names: string, verbose: string): string[] {
  const bad: string[] = [];
  for (const name of names.split("\n").filter(Boolean)) {
    if (name.startsWith("/") || name.split("/").includes("..")) bad.push(name);
  }
  for (const line of verbose.split("\n").filter(Boolean)) {
    if (line[0] === "l" || line[0] === "h") bad.push(`${line.trim()} (link)`);
  }
  return bad;
}

async function downloadAndExtract(
  owner: string,
  repo: string,
  sha: string,
  destination: string,
  fetchImpl: FetchLike,
): Promise<string[]> {
  const response = await fetchImpl(`https://codeload.github.com/${owner}/${repo}/tar.gz/${sha}`);
  if (!response.ok)
    return [`Could not download ${owner}/${repo}@${sha} (HTTP ${response.status}).`];

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-recipe-"));
  try {
    const archive = path.join(work, "recipe.tar.gz");
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

    const tarOptions = { encoding: "utf-8" as const, maxBuffer: 64 * 1024 * 1024 };
    const unsafe = unsafeArchiveEntries(
      execFileSync("tar", ["-tzf", archive], tarOptions),
      execFileSync("tar", ["-tvzf", archive], tarOptions),
    );
    if (unsafe.length > 0) {
      return [`Refusing archive with links or unsafe paths: ${unsafe.slice(0, 5).join(", ")}`];
    }

    const extracted = path.join(work, "extracted");
    fs.mkdirSync(extracted);
    execFileSync("tar", ["-xzf", archive, "-C", extracted, "--strip-components=1"]);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(extracted, destination);
    return [];
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** Resolve a `-w` spec to a loaded, data-only recipe. Network is used only for `github:` sources. */
export async function resolveExternalRecipe(
  spec: string,
  options: ResolveExternalOptions,
): Promise<ResolveExternalResult> {
  const parsed = parseExternalSpec(spec, options.cwd);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const { source } = parsed;

  if (source.kind === "path") {
    const loaded = loadRecipeDirectory(source.dir, { source: source.dir });
    return loaded.ok ? { ok: true, recipe: loaded.recipe } : { ok: false, errors: loaded.errors };
  }

  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const ref = source.ref ?? "HEAD";
  const shaResponse = await fetchImpl(
    `https://api.github.com/repos/${source.owner}/${source.repo}/commits/${encodeURIComponent(ref)}`,
    { headers: { Accept: "application/vnd.github.sha", "User-Agent": "zealakit" } },
  );
  if (!shaResponse.ok) {
    return {
      ok: false,
      errors: [
        `Could not resolve '${ref}' in ${source.owner}/${source.repo} (HTTP ${shaResponse.status}).`,
      ],
    };
  }
  const sha = (await shaResponse.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    return {
      ok: false,
      errors: [`Unexpected commit response for ${source.owner}/${source.repo}@${ref}.`],
    };
  }

  const cached = path.join(options.cacheDir, "github", source.owner, source.repo, sha);
  if (!fs.existsSync(cached)) {
    const errors = await downloadAndExtract(source.owner, source.repo, sha, cached, fetchImpl);
    if (errors.length > 0) return { ok: false, errors };
  }

  const dir = path.join(cached, source.subPath);
  const rel = path.relative(cached, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, errors: ["The recipe path escapes the repository."] };
  }
  const loaded = loadRecipeDirectory(dir, { source: spec, ref: source.ref, sha });
  return loaded.ok ? { ok: true, recipe: loaded.recipe } : { ok: false, errors: loaded.errors };
}
