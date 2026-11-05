import os from "node:os";
import path from "node:path";
import type { DiscoveryFeedbackPaths } from "./types.js";

const CONFIG_DIR_ENV = "ZEALAKIT_CONFIG_DIR";

/**
 * Resolve the user-level zealakit config directory.
 * Override with `ZEALAKIT_CONFIG_DIR` (used in tests).
 */
export function resolveZealakitConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const override = env[CONFIG_DIR_ENV]?.trim();
  if (override) {
    return path.resolve(override);
  }

  if (process.platform === "win32") {
    const base = env.APPDATA?.trim() || path.join(homedir(), "AppData", "Roaming");
    return path.join(base, "zealakit");
  }

  const xdg = env.XDG_CONFIG_HOME?.trim();
  if (xdg) {
    return path.join(xdg, "zealakit");
  }
  return path.join(homedir(), ".config", "zealakit");
}

export function resolveDiscoveryFeedbackPaths(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): DiscoveryFeedbackPaths {
  const configDir = resolveZealakitConfigDir(env, homedir);
  return {
    configDir,
    storePath: path.join(configDir, "discovery-feedback.json"),
  };
}

export { CONFIG_DIR_ENV };
