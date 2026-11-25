import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectManifest } from "../project-manifest.js";
import { inferProjectName } from "../project/add.js";
import { compareKitVersions } from "../project/checks.js";
import { getNpmManifest, getRecipe, getTemplate, getTemplateOverlayId } from "../registry/index.js";
import { stagePlan } from "../scaffold/index.js";
import { getManifestAdapter } from "../scaffold/manifest.js";
import { KIT_VERSION } from "../scaffold/paths.js";
import { buildScaffoldPlan, planIsReady } from "../scaffold/plan.js";

export type OutdatedEntry = {
  package: string;
  /** Where the range is declared in the project. */
  field: "dependencies" | "devDependencies" | "go.mod" | "dev" | "pyproject.toml";
  /** Range the project currently declares. */
  project: string;
  /** Range the installed kit would write today. */
  kit: string;
  /** `template:<id>` or `recipe:<id>` that contributes the package. */
  source: string;
  /** `behind`: the kit is newer · `ahead`: the project is newer · `different`: not comparable. */
  status: "behind" | "ahead" | "different";
};

export type OutdatedReport = {
  kitVersion: { project: string; installed: string; status: "same" | "behind" | "ahead" };
  entries: OutdatedEntry[];
  blockers: string[];
};

function baseVersion(range: string): string {
  return range.replace(/^[^\d]*/, "");
}

function statusFor(project: string, kit: string): OutdatedEntry["status"] {
  const a = baseVersion(project);
  const b = baseVersion(kit);
  if (!/^\d/.test(a) || !/^\d/.test(b)) return "different";
  const cmp = compareKitVersions(a, b);
  return cmp < 0 ? "behind" : cmp > 0 ? "ahead" : "different";
}

type Record = { [name: string]: string };

function readPackageJson(file: string): { dependencies: Record; devDependencies: Record } {
  const json = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    dependencies?: Record;
    devDependencies?: Record;
  };
  return { dependencies: json.dependencies ?? {}, devDependencies: json.devDependencies ?? {} };
}

/** Module requirements declared in a go.mod (direct and indirect). */
export function parseGoRequires(goMod: string): Record {
  const out: Record = {};
  let inBlock = false;
  for (const raw of goMod.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (/^require\s*\($/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ")") {
      inBlock = false;
      continue;
    }
    const single = /^require\s+(\S+)\s+(v\S+)$/.exec(line);
    const block = inBlock ? /^(\S+)\s+(v\S+)$/.exec(line) : null;
    const match = single ?? block;
    if (match?.[1] && match[2]) out[match[1]] = match[2];
  }
  return out;
}

function npmSource(
  name: string,
  field: "dependencies" | "devDependencies",
  recipeIds: string[],
  templateId: string,
): string {
  const overlay = getTemplateOverlayId(templateId);
  for (let index = recipeIds.length - 1; index >= 0; index -= 1) {
    const id = recipeIds[index] as string;
    const npm = getNpmManifest(getRecipe(id) ?? ({ manifest: { ecosystem: "go" } } as never));
    if (!npm) continue;
    const own = field === "dependencies" ? npm.packages : npm.devDependencies;
    const extra =
      field === "dependencies"
        ? npm.overlayPackages?.[overlay]
        : npm.overlayDevDependencies?.[overlay];
    if (name in own || (extra && name in extra)) return `recipe:${id}`;
  }
  return `template:${templateId}`;
}

function adapterSource(name: string, recipeIds: string[], templateId: string): string {
  for (let index = recipeIds.length - 1; index >= 0; index -= 1) {
    const id = recipeIds[index] as string;
    const manifest = getRecipe(id)?.manifest;
    if (manifest?.ecosystem === "python") {
      const key = name.toLowerCase();
      const has = (record: { [name: string]: string }) =>
        Object.keys(record).some((n) => n.toLowerCase() === key);
      if (has(manifest.dependencies) || has(manifest.devDependencies)) return `recipe:${id}`;
    }
  }
  return `template:${templateId}`;
}

function goSource(name: string, recipeIds: string[], templateId: string): string {
  for (const id of recipeIds) {
    const manifest = getRecipe(id)?.manifest;
    if (manifest?.ecosystem === "go" && name in manifest.goModules) return `recipe:${id}`;
  }
  return `template:${templateId}`;
}

/**
 * Compare the project's dependency ranges with what the installed kit would
 * generate today for the same template and recipes. Report-only.
 */
export function computeOutdated(projectDir: string): OutdatedReport {
  const root = path.resolve(projectDir);
  const loaded = readProjectManifest(root);
  const empty: OutdatedReport = {
    kitVersion: { project: "", installed: KIT_VERSION, status: "same" },
    entries: [],
    blockers: [],
  };
  if (!loaded) {
    return { ...empty, blockers: [`No zealakit.json in '${root}'.`] };
  }
  if (!loaded.ok) return { ...empty, blockers: loaded.errors };
  const { manifest } = loaded;

  const cmp = compareKitVersions(manifest.kitVersion, KIT_VERSION);
  const report: OutdatedReport = {
    kitVersion: {
      project: manifest.kitVersion,
      installed: KIT_VERSION,
      status: cmp === 0 ? "same" : cmp < 0 ? "behind" : "ahead",
    },
    entries: [],
    blockers: [],
  };
  if (!getTemplate(manifest.template)) {
    report.blockers.push(`Template '${manifest.template}' is not known to this zealakit version.`);
    return report;
  }

  const plan = buildScaffoldPlan(
    {
      projectName: inferProjectName(root, manifest.ecosystem),
      templateId: manifest.template,
      recipeIds: [...manifest.recipes],
    },
    os.tmpdir(),
    { manifest: false },
  );
  if (!planIsReady(plan)) {
    report.blockers.push(...plan.blockers);
    return report;
  }

  const staged = stagePlan(plan);
  try {
    const adapter = getManifestAdapter(manifest.ecosystem);
    if (adapter.readDependencies) {
      const mine = new Map(
        adapter.readDependencies(root).map((dep) => [`${dep.field}:${dep.package}`, dep]),
      );
      for (const dep of adapter.readDependencies(staged.dir)) {
        const current = mine.get(`${dep.field}:${dep.package}`);
        if (current && current.range !== dep.range) {
          report.entries.push({
            package: dep.package,
            field: dep.field as OutdatedEntry["field"],
            project: current.range,
            kit: dep.range,
            source: adapterSource(dep.package, manifest.recipes, manifest.template),
            status: statusFor(current.range, dep.range),
          });
        }
      }
      report.entries.sort((a, b) => a.package.localeCompare(b.package));
      return report;
    }

    if (manifest.ecosystem === "go") {
      const projectMod = path.join(root, "go.mod");
      if (!fs.existsSync(projectMod)) return report;
      const mine = parseGoRequires(fs.readFileSync(projectMod, "utf-8"));
      const kit = parseGoRequires(fs.readFileSync(path.join(staged.dir, "go.mod"), "utf-8"));
      for (const [name, version] of Object.entries(kit).sort(([a], [b]) => a.localeCompare(b))) {
        const current = mine[name];
        if (current && current !== version) {
          report.entries.push({
            package: name,
            field: "go.mod",
            project: current,
            kit: version,
            source: goSource(name, manifest.recipes, manifest.template),
            status: statusFor(current, version),
          });
        }
      }
      return report;
    }

    const projectPkg = path.join(root, "package.json");
    if (!fs.existsSync(projectPkg)) return report;
    const mine = readPackageJson(projectPkg);
    const kit = readPackageJson(path.join(staged.dir, "package.json"));
    for (const field of ["dependencies", "devDependencies"] as const) {
      for (const [name, range] of Object.entries(kit[field]).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const current = mine[field][name];
        if (current && current !== range) {
          report.entries.push({
            package: name,
            field,
            project: current,
            kit: range,
            source: npmSource(name, field, manifest.recipes, manifest.template),
            status: statusFor(current, range),
          });
        }
      }
    }
    return report;
  } finally {
    staged.dispose();
  }
}
