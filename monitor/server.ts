import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  getRecipeCategories,
  RECIPE_CATEGORIES,
  type RecipeConfig,
  recipes,
  SCOPES,
  templates,
} from "@zealakit/core";
import { registerNodeEcosystem } from "@zealakit/ecosystem-node";

registerNodeEcosystem();

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PREFERRED_PORT = 4000;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const RECIPES_REGISTRY_DIR = "packages/ecosystem-node/src/registry/recipes";

function recipeRegistryFile(recipeId: string): string {
  return `${RECIPES_REGISTRY_DIR}/${recipeId}.ts`;
}

type DepType = "dep" | "dev";

type PackageEntry = {
  name: string;
  current: string;
  latest: string | null;
  depType: DepType;
  needsUpdate: boolean;
  overlay?: string;
  recipeId?: string;
  error?: string;
};

type PackageGroup = {
  label: string;
  filePath: string;
  relativePath: string;
  recipeId?: string;
  /** Template scope or recipe categories shown as fixed-color tags */
  tag?: string;
  tags?: string[];
  tagKind?: "scope" | "category";
  /** False when UI must not mutate this group (unused for now; root uses pnpm install) */
  allowUpdate: boolean;
  packages: PackageEntry[];
};

type UpdateBody = {
  filePath: string;
  packageName: string;
  newVersion: string;
  depType: DepType;
  recipeId?: string;
  overlay?: string;
};

const latestCache = new Map<string, Promise<string>>();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    "Content-Type": contentType,
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

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function assetIdFromPath(parts: string[]): string | undefined {
  // templates/<ecosystem>/<id>/... or recipes/<ecosystem>/<id>/...
  if (parts.length >= 3 && (parts[0] === "templates" || parts[0] === "recipes")) {
    return parts[2];
  }
  return undefined;
}

function groupLabel(relativePath: string): string {
  if (relativePath === "package.json") return "Root";
  const parts = relativePath.split("/");
  const id = assetIdFromPath(parts);
  if (parts[0] === "templates" && id) {
    return `template/${id}`;
  }
  if (parts[0] === "recipes" && id) {
    return `recipe/${id}`;
  }
  return relativePath;
}

async function walkForPackageJson(dir: string, out: string[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        await walkForPackageJson(fullPath, out);
        continue;
      }
      if (entry.isFile() && entry.name === "package.json") {
        out.push(fullPath);
      }
    }
  } catch {
    return;
  }
}

async function discoverPackageJsonFiles(): Promise<string[]> {
  const files = new Set<string>([path.join(ROOT, "package.json")]);

  const templateFiles: string[] = [];
  await walkForPackageJson(path.join(ROOT, "templates"), templateFiles);
  for (const file of templateFiles) files.add(file);

  const recipeFiles: string[] = [];
  await walkForPackageJson(path.join(ROOT, "recipes"), recipeFiles);
  for (const file of recipeFiles) files.add(file);

  return [...files].sort((a, b) => a.localeCompare(b));
}

function stripRangePrefix(version: string): string {
  return version.replace(/^[~^>=<\s]+/, "").trim();
}

function parseSemverParts(version: string): number[] | null {
  const cleaned = stripRangePrefix(version).split("-")[0]?.split("+")[0] ?? "";
  const parts = cleaned.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return null;
  while (parts.length < 3) parts.push(0);
  return parts;
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) return a === b ? 0 : -1;
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function needsUpdate(current: string, latest: string | null): boolean {
  if (!latest) return false;
  if (current === "latest" || current === "*") return false;
  return compareSemver(current, latest) < 0;
}

function preserveVersionPrefix(current: string, latest: string): string {
  const match = current.match(/^([~^])/);
  return match ? `${match[1]}${latest}` : latest;
}

async function fetchLatestVersion(packageName: string): Promise<string> {
  const cached = latestCache.get(packageName);
  if (cached) return cached;

  const request = (async () => {
    const encoded = packageName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const url = `https://registry.npmjs.org/${encoded}/latest`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`registry ${response.status} for ${packageName}`);
    }
    const data = (await response.json()) as { version?: string };
    if (!data.version) {
      throw new Error(`missing version for ${packageName}`);
    }
    return data.version;
  })();

  latestCache.set(packageName, request);
  try {
    return await request;
  } catch (error) {
    latestCache.delete(packageName);
    throw error;
  }
}

async function collectEntries(
  deps: Record<string, string> | undefined,
  depType: DepType,
  meta: { overlay?: string; recipeId?: string } = {},
): Promise<PackageEntry[]> {
  if (!deps) return [];

  const names = Object.keys(deps).sort((a, b) => a.localeCompare(b));
  const entries = await Promise.all(
    names.map(async (name) => {
      const current = deps[name] ?? "";
      try {
        const latest = await fetchLatestVersion(name);
        return {
          name,
          current,
          latest,
          depType,
          needsUpdate: needsUpdate(current, latest),
          ...meta,
        } satisfies PackageEntry;
      } catch (error) {
        return {
          name,
          current,
          latest: null,
          depType,
          needsUpdate: false,
          ...meta,
          error: error instanceof Error ? error.message : String(error),
        } satisfies PackageEntry;
      }
    }),
  );

  return entries;
}

async function collectRecipeEntries(recipe: RecipeConfig): Promise<PackageEntry[]> {
  const meta = { recipeId: recipe.id };
  const packages = [
    ...(await collectEntries(recipe.packages, "dep", meta)),
    ...(await collectEntries(recipe.devDependencies, "dev", meta)),
  ];

  for (const [overlay, deps] of Object.entries(recipe.overlayPackages ?? {})) {
    packages.push(...(await collectEntries(deps, "dep", { ...meta, overlay })));
  }
  for (const [overlay, deps] of Object.entries(recipe.overlayDevDependencies ?? {})) {
    packages.push(...(await collectEntries(deps, "dev", { ...meta, overlay })));
  }

  return packages;
}

async function buildRecipeGroups(): Promise<PackageGroup[]> {
  const groups: PackageGroup[] = [];
  const ids = Object.keys(recipes).sort((a, b) => {
    const recipeA = recipes[a];
    const recipeB = recipes[b];
    const rank = (category: string | undefined) => {
      const idx = (RECIPE_CATEGORIES as readonly string[]).indexOf(category ?? "");
      return idx === -1 ? RECIPE_CATEGORIES.length : idx;
    };
    const primaryA = recipeA ? getRecipeCategories(recipeA)[0] : undefined;
    const primaryB = recipeB ? getRecipeCategories(recipeB)[0] : undefined;
    const categoryCmp = rank(primaryA) - rank(primaryB);
    if (categoryCmp !== 0) return categoryCmp;
    return a.localeCompare(b);
  });

  for (const id of ids) {
    const recipe = recipes[id];
    if (!recipe) continue;

    const categories = getRecipeCategories(recipe);
    const packages = await collectRecipeEntries(recipe);
    groups.push({
      label: `recipe/${recipe.id}`,
      filePath: recipeRegistryFile(recipe.id),
      relativePath: recipeRegistryFile(recipe.id),
      recipeId: recipe.id,
      tag: categories[0],
      tags: categories,
      tagKind: "category",
      allowUpdate: true,
      packages,
    });
  }

  return groups;
}

async function buildPackagesResponse(): Promise<PackageGroup[]> {
  const files = await discoverPackageJsonFiles();
  const groups: PackageGroup[] = [];

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(ROOT, filePath));
    const raw = await readFile(filePath, "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const packages = [
      ...(await collectEntries(pkg.dependencies, "dep")),
      ...(await collectEntries(pkg.devDependencies, "dev")),
    ];

    const templateId = relativePath.startsWith("templates/")
      ? assetIdFromPath(relativePath.split("/"))
      : undefined;
    const template = templateId ? templates[templateId] : undefined;

    groups.push({
      label: groupLabel(relativePath),
      filePath: relativePath,
      relativePath,
      allowUpdate: true,
      ...(template ? { tag: template.scope, tagKind: "scope" as const } : {}),
      packages,
    });
  }

  groups.push(...(await buildRecipeGroups()));
  return groups;
}

function resolveSafePackageJsonPath(relativeOrAbsolute: string): string {
  const absolute = path.isAbsolute(relativeOrAbsolute)
    ? path.normalize(relativeOrAbsolute)
    : path.resolve(ROOT, relativeOrAbsolute);
  const relative = path.relative(ROOT, absolute);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("filePath must stay inside the project root");
  }
  if (path.basename(absolute) !== "package.json") {
    throw new Error("filePath must point to a package.json");
  }

  const posixRel = toPosix(relative);
  const allowed =
    posixRel === "package.json" ||
    posixRel.startsWith("templates/") ||
    posixRel.startsWith("recipes/");
  if (!allowed) {
    throw new Error("filePath must be root, templates/*, or recipes/* package.json");
  }

  return absolute;
}

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

/** Each recipe module exports `defineRecipe({ ... })`; the object literal is the editable block. */
function findRecipeBlockRange(source: string, recipeId: string): { start: number; end: number } {
  const callIndex = source.indexOf("defineRecipe({");
  if (callIndex === -1) {
    throw new Error(`defineRecipe({ … }) not found in ${recipeRegistryFile(recipeId)}`);
  }

  const openIndex = source.indexOf("{", callIndex);
  if (openIndex === -1) {
    throw new Error(`Recipe "${recipeId}" has no object body`);
  }
  const end = findMatchingBrace(source, openIndex);
  return { start: openIndex, end };
}

function replacePackageVersionInBlock(
  block: string,
  packageName: string,
  currentVersion: string,
  nextVersion: string,
): string {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedCurrent = currentVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`("${escapedName}"\\s*:\\s*")${escapedCurrent}(")`),
    new RegExp(`('${escapedName}'\\s*:\\s*")${escapedCurrent}(")`),
    new RegExp(`(\\b${escapedName}\\s*:\\s*")${escapedCurrent}(")`),
  ];

  for (const pattern of patterns) {
    if (pattern.test(block)) {
      return block.replace(pattern, `$1${nextVersion}$2`);
    }
  }

  throw new Error(`Could not find ${packageName}: "${currentVersion}" in recipe block`);
}

function extractVersionAssignment(
  block: string,
  packageName: string,
): { current: string; matchIndex: number } {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`"${escapedName}"\\s*:\\s*"([^"]+)"`),
    new RegExp(`'${escapedName}'\\s*:\\s*"([^"]+)"`),
    new RegExp(`\\b${escapedName}\\s*:\\s*"([^"]+)"`),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(block);
    if (match?.[1] != null && match.index != null) {
      return { current: match[1], matchIndex: match.index };
    }
  }

  throw new Error(`Package ${packageName} not found in recipe block`);
}

function narrowBlockForBucket(
  recipeBlock: string,
  depType: DepType,
  overlay?: string,
): { block: string; offset: number } {
  if (overlay) {
    const field = depType === "dep" ? "overlayPackages" : "overlayDevDependencies";
    const fieldMatch = new RegExp(`${field}\\s*:\\s*\\{`).exec(recipeBlock);
    if (!fieldMatch || fieldMatch.index == null) {
      throw new Error(`Missing ${field} in recipe`);
    }
    const fieldOpen = recipeBlock.indexOf("{", fieldMatch.index);
    const fieldClose = findMatchingBrace(recipeBlock, fieldOpen);
    const fieldBlock = recipeBlock.slice(fieldOpen, fieldClose + 1);

    const overlayKey = /^[A-Za-z_][\w-]*$/.test(overlay) ? overlay : JSON.stringify(overlay);
    const escapedOverlay = overlay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const overlayPatterns = [
      new RegExp(`\\n\\s*${escapedOverlay}\\s*:\\s*\\{`),
      new RegExp(`\\n\\s*"${escapedOverlay}"\\s*:\\s*\\{`),
      new RegExp(`\\n\\s*'${escapedOverlay}'\\s*:\\s*\\{`),
    ];
    let overlayMatch: RegExpExecArray | null = null;
    for (const pattern of overlayPatterns) {
      overlayMatch = pattern.exec(fieldBlock);
      if (overlayMatch) break;
    }
    if (!overlayMatch || overlayMatch.index == null) {
      throw new Error(`Missing overlay "${overlayKey}" under ${field}`);
    }
    const overlayOpen = fieldBlock.indexOf("{", overlayMatch.index);
    const overlayClose = findMatchingBrace(fieldBlock, overlayOpen);
    return {
      block: fieldBlock.slice(overlayOpen, overlayClose + 1),
      offset: fieldOpen + overlayOpen,
    };
  }

  const field = depType === "dep" ? "packages" : "devDependencies";
  // Prefer exact field names; avoid matching overlayPackages when looking for packages
  const fieldMatch =
    field === "packages"
      ? /(?:^|\n)\s*packages\s*:\s*\{/.exec(recipeBlock)
      : /(?:^|\n)\s*devDependencies\s*:\s*\{/.exec(recipeBlock);
  if (!fieldMatch || fieldMatch.index == null) {
    throw new Error(`Missing ${field} in recipe`);
  }
  const fieldOpen = recipeBlock.indexOf("{", fieldMatch.index);
  const fieldClose = findMatchingBrace(recipeBlock, fieldOpen);
  return {
    block: recipeBlock.slice(fieldOpen, fieldClose + 1),
    offset: fieldOpen,
  };
}

async function updateRecipeRegistry(body: UpdateBody): Promise<void> {
  if (!body.recipeId) {
    throw new Error("recipeId is required for recipe updates");
  }

  if (!/^[a-z0-9-]+$/.test(body.recipeId) || !recipes[body.recipeId]) {
    throw new Error(`Unknown recipe "${body.recipeId}"`);
  }

  const absolute = path.join(ROOT, recipeRegistryFile(body.recipeId));
  const source = await readFile(absolute, "utf8");
  const { start, end } = findRecipeBlockRange(source, body.recipeId);
  const recipeBlock = source.slice(start, end + 1);
  const { block, offset } = narrowBlockForBucket(recipeBlock, body.depType, body.overlay);
  const { current } = extractVersionAssignment(block, body.packageName);
  const written = preserveVersionPrefix(current, stripRangePrefix(body.newVersion));
  const updatedBucket = replacePackageVersionInBlock(block, body.packageName, current, written);
  const updatedRecipe =
    recipeBlock.slice(0, offset) + updatedBucket + recipeBlock.slice(offset + block.length);
  const next = source.slice(0, start) + updatedRecipe + source.slice(end + 1);
  await writeFile(absolute, next, "utf8");
}

async function refreshRootLockfile(packageName: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("pnpm", ["up", packageName], {
      cwd: ROOT,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
      shell: process.platform === "win32",
    });
    return [stdout, stderr].filter(Boolean).join("\n").trim();
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const detail = [err.stderr, err.stdout, err.message].filter(Boolean).join("\n").trim();
    throw new Error(`pnpm up ${packageName} failed${detail ? `:\n${detail}` : ""}`);
  }
}

async function updatePackageJson(body: UpdateBody): Promise<{ lockfileSynced?: boolean }> {
  if (!body.filePath || !body.packageName || !body.newVersion || !body.depType) {
    throw new Error("filePath, packageName, newVersion, and depType are required");
  }
  if (body.depType !== "dep" && body.depType !== "dev") {
    throw new Error('depType must be "dep" or "dev"');
  }

  if (body.recipeId) {
    await updateRecipeRegistry(body);
    return {};
  }

  const absolute = resolveSafePackageJsonPath(body.filePath);
  const relativePath = toPosix(path.relative(ROOT, absolute));
  const raw = await readFile(absolute, "utf8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };

  const field = body.depType === "dep" ? "dependencies" : "devDependencies";
  const bucket = pkg[field];
  if (!bucket || !(body.packageName in bucket)) {
    throw new Error(
      `${body.packageName} not found in ${field} of ${toPosix(path.relative(ROOT, absolute))}`,
    );
  }

  const current = bucket[body.packageName] ?? "";
  bucket[body.packageName] = preserveVersionPrefix(current, stripRangePrefix(body.newVersion));
  await writeFile(absolute, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  if (relativePath === "package.json") {
    await refreshRootLockfile(body.packageName);
    return { lockfileSynced: true };
  }

  return {};
}

async function handleGetPackages(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const groups = await buildPackagesResponse();
  sendJson(res, 200, {
    groups,
    scopes: [...SCOPES],
    categories: [...RECIPE_CATEGORIES],
  });
}

async function handlePostUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as UpdateBody;
  const result = await updatePackageJson(body);
  sendJson(res, 200, { ok: true, ...result });
}

async function handleIndex(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const htmlPath = path.join(__dirname, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const injected = html.replace(
    "/*__ZEALAKIT_CONSTANTS__*/",
    `window.__ZEALAKIT__ = ${JSON.stringify({
      scopes: [...SCOPES],
      categories: [...RECIPE_CATEGORIES],
    })};`,
  );
  sendText(res, 200, injected, "text/html; charset=utf-8");
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HOST}`);

  try {
    if (method === "GET" && url.pathname === "/") {
      await handleIndex(req, res);
      return;
    }
    if (method === "GET" && url.pathname === "/api/packages") {
      await handleGetPackages(req, res);
      return;
    }
    if (method === "POST" && url.pathname === "/api/update") {
      await handlePostUpdate(req, res);
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}

async function listen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleRequest(req, res);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        server.close();
        void listen(port + 1).then(resolve, reject);
        return;
      }
      reject(error);
    });

    server.listen(port, HOST, () => {
      resolve(port);
    });
  });
}

const port = await listen(PREFERRED_PORT);
console.log(`Dependency monitor: http://${HOST}:${port}`);
