import fs from "node:fs";
import path from "node:path";

import { assertStagingRealPath, resolveStagingPath } from "@zealakit/core/ecosystem";

/** Append a section to `.env.example` once (no-op when absent or already present). */
export function appendEnvSection(targetDir: string, marker: string, section: string): void {
  const file = resolveStagingPath(targetDir, ".env.example");
  if (!fs.existsSync(file)) return;
  assertStagingRealPath(targetDir, file);
  const raw = fs.readFileSync(file, "utf-8");
  if (raw.includes(marker)) return;
  fs.writeFileSync(file, `${raw.trimEnd()}\n\n${section.trimEnd()}\n`, "utf-8");
}

/** Write a generated file (creating folders) inside the staging directory. */
export function writeStagedFile(targetDir: string, relativePath: string, content: string): void {
  const file = resolveStagingPath(targetDir, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertStagingRealPath(targetDir, path.dirname(file));
  fs.writeFileSync(file, content, "utf-8");
}
