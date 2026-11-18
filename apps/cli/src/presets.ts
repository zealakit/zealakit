import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isPackageManager,
  type PackageManager,
  validateRecipeIds,
  validateTemplate,
} from "@zealakit/core/internal";

/** A saved `create` configuration. Every field is optional; flags always win. */
export type Preset = {
  template?: string;
  recipes?: string[];
  packageManager?: PackageManager;
  install?: boolean;
  git?: boolean;
};

export type PresetSource = "project" | "user";
export type PresetEntry = { name: string; preset: Preset; source: PresetSource };

export const PROJECT_CONFIG_FILE = "zealakit.config.json";
const USER_PRESETS_FILE = "presets.json";

/** `$ZEALAKIT_CONFIG_DIR`, else `$XDG_CONFIG_HOME/zealakit`, else `~/.config/zealakit`. */
export function userConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ZEALAKIT_CONFIG_DIR) return env.ZEALAKIT_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "zealakit");
}

export function userPresetsFile(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(userConfigDir(env), USER_PRESETS_FILE);
}

function readPresetFile(file: string): Record<string, unknown> {
  if (!fs.existsSync(file)) return {};
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const presets = (json as { presets?: unknown } | null)?.presets;
  if (presets === undefined) return {};
  if (typeof presets !== "object" || presets === null || Array.isArray(presets)) {
    throw new Error(`${file}: "presets" must be an object keyed by preset name.`);
  }
  return presets as Record<string, unknown>;
}

/** Validate a preset against the live registry; returns error messages. */
export function validatePreset(name: string, value: unknown): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    errors.push(`Preset name '${name}' may only contain letters, digits, '.', '_' and '-'.`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [...errors, `Preset '${name}' must be an object.`];
  }
  const preset = value as Record<string, unknown>;
  if (preset.template !== undefined) {
    if (typeof preset.template !== "string")
      errors.push(`Preset '${name}': template must be a string.`);
    else errors.push(...validateTemplate(preset.template).errors);
  }
  if (preset.recipes !== undefined) {
    if (!Array.isArray(preset.recipes) || preset.recipes.some((id) => typeof id !== "string")) {
      errors.push(`Preset '${name}': recipes must be an array of recipe ids.`);
    } else {
      errors.push(...validateRecipeIds(preset.recipes as string[]).errors);
    }
  }
  if (
    preset.packageManager !== undefined &&
    !(typeof preset.packageManager === "string" && isPackageManager(preset.packageManager))
  ) {
    errors.push(`Preset '${name}': packageManager must be one of npm, pnpm, yarn, bun.`);
  }
  for (const flag of ["install", "git"] as const) {
    if (preset[flag] !== undefined && typeof preset[flag] !== "boolean") {
      errors.push(`Preset '${name}': ${flag} must be true or false.`);
    }
  }
  return errors;
}

/** Project-local presets override user presets of the same name. */
export function listPresets(cwd: string, env: NodeJS.ProcessEnv = process.env): PresetEntry[] {
  const merged = new Map<string, PresetEntry>();
  const layers: Array<[PresetSource, string]> = [
    ["user", userPresetsFile(env)],
    ["project", path.join(cwd, PROJECT_CONFIG_FILE)],
  ];
  for (const [source, file] of layers) {
    for (const [name, preset] of Object.entries(readPresetFile(file))) {
      merged.set(name, { name, preset: preset as Preset, source });
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPreset(
  name: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): PresetEntry | undefined {
  return listPresets(cwd, env).find((entry) => entry.name === name);
}

function writeUserPresets(presets: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
  const file = userPresetsFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ presets }, null, 2)}\n`, "utf-8");
}

/** Save to the user-level presets file; throws on an invalid preset. */
export function savePreset(
  name: string,
  preset: Preset,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const errors = validatePreset(name, preset);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const presets = readPresetFile(userPresetsFile(env));
  presets[name] = preset;
  writeUserPresets(presets, env);
}

export function removePreset(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const presets = readPresetFile(userPresetsFile(env));
  if (!(name in presets)) return false;
  delete presets[name];
  writeUserPresets(presets, env);
  return true;
}

export function formatPreset(entry: PresetEntry): string {
  const { preset } = entry;
  const parts = [
    preset.template ? `template=${preset.template}` : undefined,
    preset.recipes?.length ? `recipes=${preset.recipes.join(",")}` : undefined,
    preset.packageManager ? `pm=${preset.packageManager}` : undefined,
    preset.install !== undefined ? `install=${preset.install}` : undefined,
    preset.git !== undefined ? `git=${preset.git}` : undefined,
  ].filter(Boolean);
  return `${entry.name}  (${entry.source})  ${parts.join("  ")}`;
}
