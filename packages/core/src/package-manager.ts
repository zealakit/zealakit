export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/**
 * Detect the invoking package manager from an `npm_config_user_agent` value
 * (e.g. `pnpm/9.1.0 npm/? node/v22 darwin arm64`). Falls back to npm.
 */
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const name = userAgent?.trim().split(/[/\s]/, 1)[0] ?? "";
  return isPackageManager(name) ? name : "npm";
}

export function installCommand(pm: PackageManager): string {
  return `${pm} install`;
}

/** `npm run dev` · `pnpm dev` · `yarn dev` · `bun run dev`. */
export function runScriptCommand(pm: PackageManager, script: string): string {
  return pm === "pnpm" || pm === "yarn" ? `${pm} ${script}` : `${pm} run ${script}`;
}

/** Rewrite a template's `npm run <script>` command for another package manager. */
export function adaptRunCommand(command: string, pm: PackageManager): string {
  const match = /^npm run (\S+)$/.exec(command.trim());
  return match?.[1] ? runScriptCommand(pm, match[1]) : command;
}
