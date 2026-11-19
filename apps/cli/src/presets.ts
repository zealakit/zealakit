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
const USER_CONFIG_FILE = "config.json";
/** Pre-config.json name; still read so saved presets keep working. */
const LEGACY_USER_PRESETS_FILE = "presets.json";

/** `$ZEALAKIT_CONFIG_DIR`, else `$XDG_CONFIG_HOME/zealakit`, else `~/.config/zealakit`. */
export function userConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ZEALAKIT_CONFIG_DIR) return env.ZEALAKIT_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "zealakit");
}

export function userPresetsFile(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(userConfigDir(env), USER_CONFIG_FILE);
}

/** Defaults applied to `create` when neither a flag nor a preset sets them. */
export type ConfigDefaults = Pick<Preset, "packageManager" | "install" | "git"> & {
  pm?: PackageManager;
};

type ConfigFile = { defaults: Record<string, unknown>; presets: Record<string, unknown> };

function readConfigFile(file: string): ConfigFile {
  const empty: ConfigFile = { defaults: {}, presets: {} };
  if (!fs.existsSync(file)) return empty;
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const root = (json ?? {}) as { presets?: unknown; defaults?: unknown };
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (root.presets !== undefined && !isObject(root.presets)) {
    throw new Error(`${file}: "presets" must be an object keyed by preset name.`);
  }
  if (root.defaults !== undefined && !isObject(root.defaults)) {
    throw new Error(`${file}: "defaults" must be an object.`);
  }
  return {
    defaults: (root.defaults as Record<string, unknown> | undefined) ?? {},
    presets: (root.presets as Record<string, unknown> | undefined) ?? {},
  };
}

function readPresetFile(file: string): Record<string, unknown> {
  return readConfigFile(file).presets;
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

/** Config layers, lowest precedence first: legacy user presets, user config, project config, `--config`. */
function configLayers(
  cwd: string,
  env: NodeJS.ProcessEnv,
  explicit?: string,
): Array<[PresetSource, string]> {
  const layers: Array<[PresetSource, string]> = [
    ["user", path.join(userConfigDir(env), LEGACY_USER_PRESETS_FILE)],
    ["user", userPresetsFile(env)],
    ["project", path.join(cwd, PROJECT_CONFIG_FILE)],
  ];
  if (explicit) layers.push(["project", path.resolve(cwd, explicit)]);
  return layers;
}

/** Later layers override earlier ones of the same preset name. */
export function listPresets(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  explicitConfig?: string,
): PresetEntry[] {
  const merged = new Map<string, PresetEntry>();
  for (const [source, file] of configLayers(cwd, env, explicitConfig)) {
    for (const [name, preset] of Object.entries(readPresetFile(file))) {
      merged.set(name, { name, preset: preset as Preset, source });
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Merged `defaults` from every config layer (later layers win). */
export function loadConfigDefaults(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  explicitConfig?: string,
): ConfigDefaults {
  const merged: Record<string, unknown> = {};
  for (const [, file] of configLayers(cwd, env, explicitConfig)) {
    Object.assign(merged, readConfigFile(file).defaults);
  }
  const errors: string[] = [];
  if (merged.pm !== undefined && !(typeof merged.pm === "string" && isPackageManager(merged.pm))) {
    errors.push("defaults.pm must be one of npm, pnpm, yarn, bun.");
  }
  for (const flag of ["install", "git"] as const) {
    if (merged[flag] !== undefined && typeof merged[flag] !== "boolean") {
      errors.push(`defaults.${flag} must be true or false.`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    ...(merged.pm ? { packageManager: merged.pm as PackageManager } : {}),
    ...(merged.install !== undefined ? { install: merged.install as boolean } : {}),
    ...(merged.git !== undefined ? { git: merged.git as boolean } : {}),
  };
}

export function getPreset(
  name: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  explicitConfig?: string,
): PresetEntry | undefined {
  return listPresets(cwd, env, explicitConfig).find((entry) => entry.name === name);
}

function writeUserPresets(presets: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
  const file = userPresetsFile(env);
  const { defaults } = readConfigFile(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify({ ...(Object.keys(defaults).length > 0 ? { defaults } : {}), presets }, null, 2)}\n`,
    "utf-8",
  );
}

/** Presets stored in the user config file (what `save`/`remove` edit); legacy file is migrated on write. */
function readUserPresets(env: NodeJS.ProcessEnv): Record<string, unknown> {
  return {
    ...readPresetFile(path.join(userConfigDir(env), LEGACY_USER_PRESETS_FILE)),
    ...readPresetFile(userPresetsFile(env)),
  };
}

/** Save to the user-level presets file; throws on an invalid preset. */
export function savePreset(
  name: string,
  preset: Preset,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const errors = validatePreset(name, preset);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const presets = readUserPresets(env);
  presets[name] = preset;
  writeUserPresets(presets, env);
}

export function removePreset(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const presets = readUserPresets(env);
  if (!(name in presets)) return false;
  delete presets[name];
  fs.rmSync(path.join(userConfigDir(env), LEGACY_USER_PRESETS_FILE), { force: true });
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
