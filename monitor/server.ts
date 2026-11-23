/**
 * Local Dependency Monitor for Zealakit.
 *
 * Scope: root + apps/* + packages/* + templates/node/* package.json files, plus
 * the npm versions declared in recipe registry modules
 * (packages/ecosystem-node/src/registry/recipes/<id>.ts).
 *
 *   pnpm monitor
 *   → http://127.0.0.1:4177
 *
 * Synced with the Zealakit Overlay monitor (same API, row model, registry
 * classification, safety rules, and check/upgrade prompts). Zealakit-specific:
 * template + recipe manifests, and recipe updates edit TypeScript source.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  getRecipeCategories,
  RECIPE_CATEGORIES,
  type RecipeConfig,
  SCOPES,
} from "@zealakit/core/internal";
import { RECIPE_LIST, templateList } from "@zealakit/ecosystem-node";

const execFileAsync = promisify(execFile);

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(moduleDir, "..");
const HOST = "127.0.0.1";
const PREFERRED_PORT = 4177;
const INDEX_HTML = path.join(moduleDir, "index.html");
const RECIPES_REGISTRY_DIR = "packages/ecosystem-node/src/registry/recipes";

/** Workspace folders scanned one level deep (explicit, never a recursive walk). */
const WORKSPACE_DIRS = ["apps", "packages"] as const;
const TEMPLATE_DIRS = ["templates/node"] as const;

type DepType = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

type ManifestKind = "root" | "workspace" | "template" | "recipe";

type ManifestInfo = {
  id: string;
  name: string;
  label: string;
  kind: ManifestKind;
  /** Template scope or recipe categories, shown as tags. */
  tags: string[];
  tagKind: "scope" | "category" | null;
  /** File that holds the declarations (package.json or recipe registry module). */
  relativePath: string;
  absolutePath: string;
  /** Recipe id for `recipe` manifests. */
  recipeId?: string;
};

type DeclaredDependency = {
  id: string;
  dependency: string;
  manifestId: string;
  packageName: string;
  kind: ManifestKind;
  depType: DepType;
  /** Recipe overlay family (`overlayPackages.next` → `next`); null otherwise. */
  overlay: string | null;
  declared: string;
  resolved: string | null;
  ecosystem: "node";
  local: boolean;
};

type UpdateClass =
  | "up-to-date"
  | "patch-available"
  | "minor-available"
  | "major-available"
  | "deprecated"
  | "registry-check-failed"
  | "skipped";

type RegistryInfo = {
  latest: string | null;
  latestPatch: string | null;
  latestMinor: string | null;
  latestMajor: string | null;
  versions: string[];
  deprecated: boolean | string | null;
  classification: UpdateClass;
  error?: string;
};

type DependencyRow = DeclaredDependency & {
  registry: RegistryInfo;
};

type UpdateRequest = {
  manifestId: string;
  dependency: string;
  depType: DepType;
  overlay: string | null;
  targetVersion: string;
  preserveRange?: boolean;
};

type SemVer = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  raw: string;
};

const DEP_TYPES: DepType[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** Recipe modules only declare runtime + dev dependencies. */
const RECIPE_DEP_TYPES: DepType[] = ["dependencies", "devDependencies"];

const registryCache = new Map<
  string,
  { ok: true; info: RegistryInfo } | { ok: false; error: string }
>();

let lastRegistryCheckAt: string | null = null;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function isLocalHost(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? "").split(":")[0]?.toLowerCase();
  return host === "127.0.0.1" || host === "localhost";
}

function readManifestName(absolutePath: string, fallback: string): string {
  const json = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as { name?: string };
  return json.name ?? fallback;
}

function recipeRegistryFile(recipeId: string): string {
  return `${RECIPES_REGISTRY_DIR}/${recipeId}.ts`;
}

function rankIn(order: readonly string[], value: string | undefined): number {
  const index = order.indexOf(value ?? "");
  return index === -1 ? order.length : index;
}

/**
 * Explicit discovery: root, immediate children of apps/ and packages/, Node
 * templates, and registered Node recipes. Go templates have no package.json;
 * tests/, scripts/, monitor/, and .sandbox/ are never scanned.
 */
function discoverManifests(): ManifestInfo[] {
  const manifests: ManifestInfo[] = [];

  const rootPkg = path.join(ROOT, "package.json");
  if (fs.existsSync(rootPkg)) {
    manifests.push({
      id: ".",
      name: readManifestName(rootPkg, "zealakit"),
      label: "Root",
      kind: "root",
      tags: [],
      tagKind: null,
      relativePath: "package.json",
      absolutePath: rootPkg,
    });
  }

  for (const base of WORKSPACE_DIRS) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const dirName of fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      const absolutePath = path.join(dir, dirName, "package.json");
      if (!fs.existsSync(absolutePath)) continue;
      const name = readManifestName(absolutePath, dirName);
      manifests.push({
        id: `${base}/${dirName}`,
        name,
        label: name,
        kind: "workspace",
        tags: [],
        tagKind: null,
        relativePath: `${base}/${dirName}/package.json`,
        absolutePath,
      });
    }
  }

  const templateScope = new Map(templateList.map((template) => [template.id, template.scope]));
  const templates: ManifestInfo[] = [];
  for (const base of TEMPLATE_DIRS) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const absolutePath = path.join(dir, entry.name, "package.json");
      if (!fs.existsSync(absolutePath)) continue;
      const scope = templateScope.get(entry.name);
      templates.push({
        id: `${base}/${entry.name}`,
        name: readManifestName(absolutePath, entry.name),
        label: `template/${entry.name}`,
        kind: "template",
        tags: scope ? [scope] : [],
        tagKind: "scope",
        relativePath: `${base}/${entry.name}/package.json`,
        absolutePath,
      });
    }
  }
  templates.sort(
    (a, b) => rankIn(SCOPES, a.tags[0]) - rankIn(SCOPES, b.tags[0]) || a.id.localeCompare(b.id),
  );
  manifests.push(...templates);

  const recipeManifests: ManifestInfo[] = [];
  for (const recipe of RECIPE_LIST) {
    const relativePath = recipeRegistryFile(recipe.id);
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    recipeManifests.push({
      id: `recipe/${recipe.id}`,
      name: recipe.id,
      label: `recipe/${recipe.id}`,
      kind: "recipe",
      tags: getRecipeCategories(recipe),
      tagKind: "category",
      relativePath,
      absolutePath,
      recipeId: recipe.id,
    });
  }
  recipeManifests.sort(
    (a, b) =>
      rankIn(RECIPE_CATEGORIES, a.tags[0]) - rankIn(RECIPE_CATEGORIES, b.tags[0]) ||
      a.id.localeCompare(b.id),
  );
  manifests.push(...recipeManifests);

  return manifests;
}

function assertApprovedManifest(manifestId: string): ManifestInfo {
  const match = discoverManifests().find((item) => item.id === manifestId);
  if (!match) {
    throw new Error(`Unknown or disallowed manifest id: ${manifestId}`);
  }
  return match;
}

function parseSemVer(input: string): SemVer | null {
  const token =
    input
      .trim()
      .match(/v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0]
      ?.replace(/^v/, "") ?? "";
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(token);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
    raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ""}`,
  };
}

function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function maxStable(versions: string[], predicate?: (v: SemVer) => boolean): string | null {
  let best: SemVer | null = null;
  for (const version of versions) {
    const parsed = parseSemVer(version);
    if (!parsed || parsed.prerelease) continue;
    if (predicate && !predicate(parsed)) continue;
    if (!best || compareSemVer(parsed, best) > 0) best = parsed;
  }
  return best?.raw ?? null;
}

function isSkippableSpec(spec: string): boolean {
  return (
    spec.startsWith("workspace:") ||
    spec.startsWith("file:") ||
    spec.startsWith("link:") ||
    spec.startsWith("portal:") ||
    spec.startsWith("catalog:") ||
    spec.includes("://") ||
    spec.startsWith("git+")
  );
}

function preserveRange(current: string, nextExact: string): string {
  if (current.startsWith("^")) return `^${nextExact}`;
  if (current.startsWith("~")) return `~${nextExact}`;
  return nextExact;
}

function classify(
  declared: string,
  info: Omit<RegistryInfo, "classification" | "error">,
): UpdateClass {
  if (info.deprecated) return "deprecated";
  if (!info.latest) return "registry-check-failed";
  const current = parseSemVer(declared);
  const latest = parseSemVer(info.latest);
  if (!current || !latest) return "registry-check-failed";
  if (compareSemVer(latest, current) <= 0) return "up-to-date";
  if (latest.major > current.major) return "major-available";
  if (latest.minor > current.minor) return "minor-available";
  return "patch-available";
}

function failedRegistryInfo(classification: UpdateClass, error: string): RegistryInfo {
  return {
    latest: null,
    latestPatch: null,
    latestMinor: null,
    latestMajor: null,
    versions: [],
    deprecated: null,
    classification,
    error,
  };
}

async function fetchRegistry(dependency: string, declared: string): Promise<RegistryInfo> {
  if (isSkippableSpec(declared)) {
    return failedRegistryInfo("skipped", "Non-registry version specification");
  }

  const cached = registryCache.get(dependency);
  if (cached?.ok) {
    return { ...cached.info, classification: classify(declared, cached.info) };
  }
  if (cached && !cached.ok) {
    return failedRegistryInfo("registry-check-failed", cached.error);
  }

  const encoded = dependency
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  try {
    const response = await fetch(`https://registry.npmjs.org/${encoded}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const error = `Registry HTTP ${response.status} for ${dependency}`;
      registryCache.set(dependency, { ok: false, error });
      return failedRegistryInfo("registry-check-failed", error);
    }

    const doc = (await response.json()) as {
      "dist-tags"?: { latest?: string };
      versions?: Record<string, { deprecated?: string }>;
      deprecated?: string;
    };

    const versions = Object.keys(doc.versions ?? {}).filter((version) => {
      const parsed = parseSemVer(version);
      return Boolean(parsed && !parsed.prerelease);
    });
    const latest = doc["dist-tags"]?.latest ?? maxStable(versions);
    const baseline = parseSemVer(declared);
    const latestPatch = baseline
      ? maxStable(versions, (v) => v.major === baseline.major && v.minor === baseline.minor)
      : null;
    const latestMinor = baseline ? maxStable(versions, (v) => v.major === baseline.major) : null;
    const latestMajor = maxStable(versions);
    const deprecated = (latest && doc.versions?.[latest]?.deprecated) || doc.deprecated || false;

    const base: Omit<RegistryInfo, "classification" | "error"> = {
      latest: latest ?? null,
      latestPatch,
      latestMinor,
      latestMajor,
      versions: versions.sort((a, b) => {
        const pa = parseSemVer(a);
        const pb = parseSemVer(b);
        if (!pa || !pb) return a.localeCompare(b);
        return compareSemVer(pb, pa);
      }),
      deprecated: deprecated === false ? false : deprecated,
    };

    registryCache.set(dependency, { ok: true, info: { ...base, classification: "up-to-date" } });
    return { ...base, classification: classify(declared, base) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    registryCache.set(dependency, { ok: false, error: message });
    return failedRegistryInfo("registry-check-failed", message);
  }
}

/** Importer ids in pnpm-lock.yaml that map to monitored package.json manifests. */
const LOCK_IMPORTER = /^ {2}(\.|(?:apps|packages|templates\/node)\/[^:\s]+):$/;

function readResolvedFromLockfile(): Map<string, string> {
  const lockPath = path.join(ROOT, "pnpm-lock.yaml");
  const resolved = new Map<string, string>();
  if (!fs.existsSync(lockPath)) return resolved;

  const lines = fs.readFileSync(lockPath, "utf8").split("\n");
  let inImporters = false;
  let currentImporter: string | null = null;
  let inDepBlock = false;

  for (const line of lines) {
    if (line === "importers:") {
      inImporters = true;
      continue;
    }
    if (inImporters && /^\S/.test(line)) {
      // pnpm 12 can emit more than one importers/packages pair (the first one
      // only carries configDependencies). Keep scanning the file so the real
      // workspace importers later in the lockfile are not skipped.
      inImporters = false;
      currentImporter = null;
      inDepBlock = false;
      continue;
    }
    if (!inImporters) continue;

    const importerMatch = LOCK_IMPORTER.exec(line);
    if (importerMatch) {
      currentImporter = importerMatch[1] ?? null;
      inDepBlock = false;
      continue;
    }
    if (/^ {2}\S/.test(line)) {
      currentImporter = null;
      inDepBlock = false;
      continue;
    }

    if (
      currentImporter &&
      /^ {4}(dependencies|devDependencies|peerDependencies|optionalDependencies):$/.test(line)
    ) {
      inDepBlock = true;
      continue;
    }

    if (currentImporter && /^ {4}\S/.test(line)) {
      inDepBlock = false;
    }

    if (!currentImporter || !inDepBlock) continue;

    const nameMatch = /^ {6}(.+):$/.exec(line);
    if (nameMatch) {
      const depName = nameMatch[1]?.replace(/^['"]|['"]$/g, "") ?? "";
      resolved.set(`${currentImporter}::pending`, depName);
      continue;
    }

    const versionMatch = /^ {8}version:\s+(.+)$/.exec(line);
    if (versionMatch) {
      const depName = resolved.get(`${currentImporter}::pending`);
      if (depName) {
        let version = versionMatch[1]?.trim() ?? "";
        version = version.replace(/^['"]|['"]$/g, "");
        // pnpm may store "1.2.3(peer@x)" — take the leading semver
        version = version.split("(")[0]?.trim() ?? version;
        resolved.set(`${currentImporter}::${depName}`, version);
        resolved.delete(`${currentImporter}::pending`);
      }
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Recipe registry modules: `export default defineRecipe({ … })`
// Versions are read from and written to the TypeScript source so the monitor
// always reflects the file on disk (never a stale in-process import).
// ---------------------------------------------------------------------------

/** Previous non-whitespace char suggests `/` starts a RegExp, not division. */
function isRegexLiteralStart(source: string, slashIndex: number): boolean {
  let i = slashIndex - 1;
  while (i >= 0 && /\s/.test(source[i] ?? "")) {
    i--;
  }
  if (i < 0) {
    return true;
  }
  const prev = source[i] ?? "";
  // Covers `pattern: /.../` and similar in recipe modules (after `:`, `(`, `,`, …).
  return "([{=!&|?:;,~^%*-+<>".includes(prev);
}

/** Index of the last character of a regex literal starting at `start` (`/`). */
function endOfRegexLiteral(source: string, start: number): number {
  let escaped = false;
  let inCharClass = false;

  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\n") {
      return start;
    }
    if (ch === "[" && !inCharClass) {
      inCharClass = true;
      continue;
    }
    if (ch === "]" && inCharClass) {
      inCharClass = false;
      continue;
    }
    if (ch === "/" && !inCharClass) {
      let j = i + 1;
      while (j < source.length && /[a-z]/i.test(source[j] ?? "")) {
        j++;
      }
      return j - 1;
    }
  }

  return start;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i] ?? "";
    const next = source[i + 1] ?? "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    // fileTransforms use `/import \{ Module \}…/` — braces inside must not affect depth.
    if (ch === "/" && isRegexLiteralStart(source, i)) {
      const end = endOfRegexLiteral(source, i);
      if (end > i) {
        i = end;
        continue;
      }
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  throw new Error("Unbalanced braces while locating recipe block");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The object literal passed to `defineRecipe(` — the editable recipe block. */
function findRecipeBlockRange(source: string, recipeId: string): { start: number; end: number } {
  const callIndex = source.indexOf("defineRecipe({");
  if (callIndex === -1) {
    throw new Error(`defineRecipe({ … }) not found in ${recipeRegistryFile(recipeId)}`);
  }
  const openIndex = source.indexOf("{", callIndex);
  return { start: openIndex, end: findMatchingBrace(source, openIndex) };
}

/**
 * Locate the `{ … }` that holds one dependency bucket inside the recipe block.
 * Returns null when the recipe does not declare that bucket.
 */
function findBucket(
  recipeBlock: string,
  depType: DepType,
  overlay: string | null,
): { block: string; offset: number } | null {
  if (overlay) {
    const field = depType === "dependencies" ? "overlayPackages" : "overlayDevDependencies";
    const fieldMatch = new RegExp(`(?:^|\\n)\\s*${field}\\s*:\\s*\\{`).exec(recipeBlock);
    if (!fieldMatch) return null;
    const fieldOpen = recipeBlock.indexOf("{", fieldMatch.index);
    const fieldClose = findMatchingBrace(recipeBlock, fieldOpen);
    const fieldBlock = recipeBlock.slice(fieldOpen, fieldClose + 1);

    const escapedOverlay = escapeRegExp(overlay);
    const overlayMatch = new RegExp(`\\n\\s*(["']?)${escapedOverlay}\\1\\s*:\\s*\\{`).exec(
      fieldBlock,
    );
    if (!overlayMatch) return null;
    const overlayOpen = fieldBlock.indexOf("{", overlayMatch.index);
    const overlayClose = findMatchingBrace(fieldBlock, overlayOpen);
    return {
      block: fieldBlock.slice(overlayOpen, overlayClose + 1),
      offset: fieldOpen + overlayOpen,
    };
  }

  const field = depType === "dependencies" ? "packages" : "devDependencies";
  // Anchor to a line start so `packages` never matches `overlayPackages`.
  const fieldMatch = new RegExp(`(?:^|\\n)\\s*${field}\\s*:\\s*\\{`).exec(recipeBlock);
  if (!fieldMatch) return null;
  const fieldOpen = recipeBlock.indexOf("{", fieldMatch.index);
  const fieldClose = findMatchingBrace(recipeBlock, fieldOpen);
  return { block: recipeBlock.slice(fieldOpen, fieldClose + 1), offset: fieldOpen };
}

/** `"name": "range"` / `'name': "range"` / `name: "range"` entries in one bucket. */
function readBucketEntries(block: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const pattern =
    /(["'])((?:@[\w.-]+\/)?[\w.-]+)\1\s*:\s*"([^"]+)"|\b([A-Za-z_][\w-]*)\s*:\s*"([^"]+)"/g;
  for (const match of block.matchAll(pattern)) {
    const name = match[2] ?? match[4];
    const version = match[3] ?? match[5];
    if (name && version) entries[name] = version;
  }
  return entries;
}

function bucketVersionPattern(dependency: string): RegExp {
  const name = escapeRegExp(dependency);
  return new RegExp(`((?:"${name}"|'${name}'|\\b${name})\\s*:\\s*")([^"]+)(")`);
}

function recipeOverlayKeys(recipe: RecipeConfig | undefined, depType: DepType): string[] {
  const npm = recipe?.manifest.ecosystem === "node" ? recipe.manifest : undefined;
  const field = depType === "dependencies" ? npm?.overlayPackages : npm?.overlayDevDependencies;
  return Object.keys(field ?? {}).sort();
}

function listRecipeDeclarations(manifest: ManifestInfo): Array<{
  depType: DepType;
  overlay: string | null;
  dependency: string;
  declared: string;
}> {
  const recipe = RECIPE_LIST.find((item) => item.id === manifest.recipeId);
  const source = fs.readFileSync(manifest.absolutePath, "utf8");
  const { start, end } = findRecipeBlockRange(source, manifest.recipeId ?? manifest.id);
  const recipeBlock = source.slice(start, end + 1);

  const out: Array<{
    depType: DepType;
    overlay: string | null;
    dependency: string;
    declared: string;
  }> = [];
  for (const depType of RECIPE_DEP_TYPES) {
    for (const overlay of [null, ...recipeOverlayKeys(recipe, depType)]) {
      const bucket = findBucket(recipeBlock, depType, overlay);
      if (!bucket) continue;
      for (const [dependency, declared] of Object.entries(readBucketEntries(bucket.block))) {
        out.push({ depType, overlay, dependency, declared });
      }
    }
  }
  return out;
}

function rowId(
  manifestId: string,
  depType: DepType,
  overlay: string | null,
  dependency: string,
): string {
  return `${manifestId}::${depType}${overlay ? `@${overlay}` : ""}::${dependency}`;
}

function listDeclarations(): DeclaredDependency[] {
  const manifests = discoverManifests();
  const lockResolved = readResolvedFromLockfile();
  const rows: DeclaredDependency[] = [];

  for (const manifest of manifests) {
    if (manifest.kind === "recipe") {
      for (const item of listRecipeDeclarations(manifest)) {
        rows.push({
          id: rowId(manifest.id, item.depType, item.overlay, item.dependency),
          dependency: item.dependency,
          manifestId: manifest.id,
          packageName: manifest.name,
          kind: manifest.kind,
          depType: item.depType,
          overlay: item.overlay,
          declared: item.declared,
          // Recipe versions are written into generated projects, not installed here.
          resolved: null,
          ecosystem: "node",
          local: isSkippableSpec(item.declared),
        });
      }
      continue;
    }

    const json = JSON.parse(fs.readFileSync(manifest.absolutePath, "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;

    for (const depType of DEP_TYPES) {
      const block = json[depType];
      if (!block) continue;
      for (const [dependency, declared] of Object.entries(block)) {
        rows.push({
          id: rowId(manifest.id, depType, null, dependency),
          dependency,
          manifestId: manifest.id,
          packageName: manifest.name,
          kind: manifest.kind,
          depType,
          overlay: null,
          declared,
          resolved: lockResolved.get(`${manifest.id}::${dependency}`) ?? null,
          ecosystem: "node",
          local: isSkippableSpec(declared),
        });
      }
    }
  }

  return rows;
}

async function buildDependencyRows(options?: { refresh?: boolean }): Promise<DependencyRow[]> {
  if (options?.refresh) {
    registryCache.clear();
  }
  const declarations = listDeclarations();

  // Warm cache once per unique dependency (using first declared sample).
  const sampleDeclared = new Map<string, string>();
  for (const item of declarations) {
    if (!sampleDeclared.has(item.dependency)) {
      sampleDeclared.set(item.dependency, item.declared);
    }
  }
  await Promise.all(
    [...sampleDeclared].map(async ([name, declared]) => {
      await fetchRegistry(name, declared);
    }),
  );

  lastRegistryCheckAt = new Date().toISOString();

  const rows: DependencyRow[] = [];
  for (const item of declarations) {
    rows.push({ ...item, registry: await fetchRegistry(item.dependency, item.declared) });
  }
  return rows;
}

const CLASS_RANK: Record<UpdateClass, number> = {
  deprecated: 0,
  "major-available": 1,
  "minor-available": 2,
  "patch-available": 3,
  "registry-check-failed": 4,
  skipped: 5,
  "up-to-date": 6,
};

function summarize(rows: DependencyRow[]) {
  const unique = new Set(rows.map((row) => row.dependency));
  const byDepClass = new Map<string, UpdateClass>();
  for (const row of rows) {
    const prev = byDepClass.get(row.dependency);
    if (!prev || CLASS_RANK[row.registry.classification] < CLASS_RANK[prev]) {
      byDepClass.set(row.dependency, row.registry.classification);
    }
  }

  let upToDate = 0;
  let updatesAvailable = 0;
  let deprecated = 0;
  let failed = 0;
  for (const classification of byDepClass.values()) {
    if (classification === "up-to-date" || classification === "skipped") {
      upToDate += 1;
    } else if (classification === "deprecated") {
      deprecated += 1;
      updatesAvailable += 1;
    } else if (classification === "registry-check-failed") {
      failed += 1;
    } else {
      updatesAvailable += 1;
    }
  }

  return {
    total: unique.size,
    outdated: updatesAvailable,
    upToDate,
    errors: failed,
    uniqueDependencies: unique.size,
    declarationCount: rows.length,
    updatesAvailable,
    deprecated,
    registryFailures: failed,
    lastRegistryCheckAt,
    ecosystems: ["node"],
  };
}

function validateUpdateRequest(input: unknown): UpdateRequest {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid update payload");
  }
  const body = input as Record<string, unknown>;
  const { manifestId, dependency, depType, targetVersion, overlay } = body;

  if (typeof manifestId !== "string" || !manifestId) {
    throw new Error("manifestId is required");
  }
  if (typeof dependency !== "string" || !dependency) {
    throw new Error("dependency is required");
  }
  if (!DEP_TYPES.includes(depType as DepType)) {
    throw new Error("depType is invalid");
  }
  if (
    overlay !== undefined &&
    overlay !== null &&
    (typeof overlay !== "string" || !/^[\w-]+$/.test(overlay))
  ) {
    throw new Error("overlay is invalid");
  }
  if (typeof targetVersion !== "string" || !targetVersion.trim()) {
    throw new Error("targetVersion is required");
  }
  if (targetVersion.includes("..") || targetVersion.includes("/") || /\s/.test(targetVersion)) {
    throw new Error("targetVersion looks unsafe");
  }

  const manifest = assertApprovedManifest(manifestId);
  if (manifest.kind === "recipe" && !RECIPE_DEP_TYPES.includes(depType as DepType)) {
    throw new Error("Recipe modules only declare dependencies and devDependencies");
  }
  if (manifest.kind !== "recipe" && overlay) {
    throw new Error("overlay is only valid for recipe manifests");
  }

  return {
    manifestId,
    dependency,
    depType: depType as DepType,
    overlay: typeof overlay === "string" ? overlay : null,
    targetVersion: targetVersion.trim().replace(/^[~^]/, ""),
    preserveRange: body.preserveRange !== false,
  };
}

type UpdateResult = {
  dryRun: boolean;
  from: string;
  to: string;
  lockfileSynced: boolean;
};

async function applyRecipeUpdate(
  manifest: ManifestInfo,
  request: UpdateRequest,
  options: { dryRun: boolean },
): Promise<UpdateResult> {
  const source = await fsp.readFile(manifest.absolutePath, "utf8");
  const { start, end } = findRecipeBlockRange(source, manifest.recipeId ?? manifest.id);
  const recipeBlock = source.slice(start, end + 1);
  const bucket = findBucket(recipeBlock, request.depType, request.overlay);
  const where = `${request.depType}${request.overlay ? ` (overlay ${request.overlay})` : ""}`;
  if (!bucket) {
    throw new Error(`${where} not declared in ${manifest.relativePath}`);
  }
  const pattern = bucketVersionPattern(request.dependency);
  const match = pattern.exec(bucket.block);
  if (!match) {
    throw new Error(`${request.dependency} not found in ${where} of ${manifest.relativePath}`);
  }

  const from = match[2] ?? "";
  const exact = request.targetVersion;
  if (!parseSemVer(exact)) {
    throw new Error(`Invalid target version: ${exact}`);
  }
  const to = request.preserveRange ? preserveRange(from, exact) : exact;

  if (options.dryRun || from === to) {
    return { dryRun: options.dryRun, from, to, lockfileSynced: false };
  }

  const updatedBucket = bucket.block.replace(pattern, `$1${to}$3`);
  const updatedRecipe =
    recipeBlock.slice(0, bucket.offset) +
    updatedBucket +
    recipeBlock.slice(bucket.offset + bucket.block.length);
  await fsp.writeFile(
    manifest.absolutePath,
    source.slice(0, start) + updatedRecipe + source.slice(end + 1),
    "utf8",
  );
  // Recipe versions are scaffold-time data: nothing in this workspace installs them.
  return { dryRun: false, from, to, lockfileSynced: false };
}

async function applyUpdate(
  request: UpdateRequest,
  options: { dryRun: boolean },
): Promise<UpdateResult> {
  const manifest = assertApprovedManifest(request.manifestId);
  if (manifest.kind === "recipe") {
    return applyRecipeUpdate(manifest, request, options);
  }

  const original = await fsp.readFile(manifest.absolutePath, "utf8");
  const json = JSON.parse(original) as Record<string, Record<string, string> | undefined>;
  const block = json[request.depType];
  if (!block || !(request.dependency in block)) {
    throw new Error(`${request.dependency} not found in ${request.depType} of ${manifest.id}`);
  }

  const from = block[request.dependency] ?? "";
  const exact = request.targetVersion;
  if (!parseSemVer(exact)) {
    throw new Error(`Invalid target version: ${exact}`);
  }
  const to = request.preserveRange ? preserveRange(from, exact) : exact;

  if (options.dryRun) {
    return { dryRun: true, from, to, lockfileSynced: false };
  }
  if (from === to) {
    return { dryRun: false, from, to, lockfileSynced: false };
  }

  block[request.dependency] = to;
  await fsp.writeFile(manifest.absolutePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");

  try {
    // Root, apps/*, packages/*, and templates/node/* are workspace importers:
    // refresh the lockfile from manifests without upgrading unrelated ranges.
    await execFileAsync("pnpm", ["install"], {
      cwd: ROOT,
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { dryRun: false, from, to, lockfileSynced: true };
  } catch (error) {
    await fsp.writeFile(manifest.absolutePath, original, "utf8");
    throw new Error(
      `Package manager update failed; restored ${manifest.relativePath}. ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

function findDeclaration(request: UpdateRequest): DeclaredDependency | undefined {
  return listDeclarations().find(
    (row) =>
      row.manifestId === request.manifestId &&
      row.dependency === request.dependency &&
      row.depType === request.depType &&
      row.overlay === request.overlay,
  );
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? "GET";
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/packages") {
    const packages = discoverManifests().map((item) => ({
      id: item.id,
      name: item.name,
      label: item.label,
      kind: item.kind,
      tags: item.tags,
      tagKind: item.tagKind,
      relativePath: item.relativePath,
    }));
    sendJson(res, 200, { packages, scopes: [...SCOPES], categories: [...RECIPE_CATEGORIES] });
    return;
  }

  if (method === "GET" && pathname === "/api/dependencies") {
    const refresh = url.searchParams.get("refresh") === "1";
    const rows = await buildDependencyRows({ refresh });
    sendJson(res, 200, { dependencies: rows, summary: summarize(rows), lastRegistryCheckAt });
    return;
  }

  if (method === "GET" && pathname === "/api/summary") {
    const rows = await buildDependencyRows();
    sendJson(res, 200, summarize(rows));
    return;
  }

  if (method === "POST" && pathname === "/api/refresh") {
    registryCache.clear();
    const rows = await buildDependencyRows({ refresh: true });
    sendJson(res, 200, { dependencies: rows, summary: summarize(rows), lastRegistryCheckAt });
    return;
  }

  if (method === "GET" && pathname === "/api/versions") {
    const name = url.searchParams.get("name");
    if (!name) {
      sendJson(res, 400, { error: "name query param is required" });
      return;
    }
    const sample = listDeclarations().find((item) => item.dependency === name)?.declared ?? "0.0.0";
    const info = await fetchRegistry(name, sample);
    sendJson(res, 200, { dependency: name, ...info });
    return;
  }

  if (method === "POST" && pathname === "/api/update") {
    const body = await readJsonBody(req);
    const dryRun =
      Boolean((body as { dryRun?: boolean }).dryRun) || url.searchParams.get("dryRun") === "1";
    const request = validateUpdateRequest(body);
    const result = await applyUpdate(request, { dryRun });
    sendJson(res, 200, { ok: true, ...request, ...result });
    return;
  }

  if (method === "POST" && pathname === "/api/update-bulk") {
    const body = (await readJsonBody(req)) as { dryRun?: boolean; updates?: unknown[] };
    const dryRun = Boolean(body.dryRun);
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      sendJson(res, 400, { error: "updates array is required" });
      return;
    }

    const results = [];
    for (const item of body.updates) {
      const request = validateUpdateRequest(item);
      // Refuse silent major upgrades unless target is explicit exact chosen by client.
      const current = findDeclaration(request);
      if (!current) {
        throw new Error(`Declaration not found for ${request.dependency}`);
      }
      const currentParsed = parseSemVer(current.declared);
      const targetParsed = parseSemVer(request.targetVersion);
      if (
        currentParsed &&
        targetParsed &&
        targetParsed.major > currentParsed.major &&
        (item as { allowMajor?: boolean }).allowMajor !== true
      ) {
        throw new Error(
          `Refusing major upgrade for ${request.dependency} (${currentParsed.raw} → ${targetParsed.raw}) without allowMajor`,
        );
      }
      results.push({ ...request, ...(await applyUpdate(request, { dryRun })) });
    }

    sendJson(res, 200, { ok: true, dryRun, results });
    return;
  }

  sendJson(res, 404, { error: `Unknown API route: ${pathname}` });
}

async function requestListener(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!isLocalHost(req)) {
      sendJson(res, 403, { error: "Host not allowed" });
      return;
    }

    const url = new URL(req.url ?? "/", `http://${HOST}`);

    if ((req.method ?? "GET") === "GET" && url.pathname === "/") {
      const html = await fsp.readFile(INDEX_HTML, "utf8");
      sendText(res, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function listen(port: number): void {
  const server = createServer((req, res) => {
    void requestListener(req, res);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && port < PREFERRED_PORT + 20) {
      listen(port + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    console.log(`[monitor] Zealakit Dependency Monitor → http://${HOST}:${port}`);
    console.log(
      "[monitor] Scope: root + apps/* + packages/* + templates/node/* + recipe registry (templates/go, tests/, .sandbox/ excluded)",
    );
  });
}

listen(PREFERRED_PORT);
