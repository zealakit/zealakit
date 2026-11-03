import fs from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "./scaffold/paths.js";

export type KitManifest = {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  engines?: Record<string, string>;
};

let cached: KitManifest | undefined;

/** The zealakit package's own `package.json` (works from `src/` and `dist/`). */
export function readKitManifest(): KitManifest {
  cached ??= JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"),
  ) as KitManifest;
  return cached;
}
