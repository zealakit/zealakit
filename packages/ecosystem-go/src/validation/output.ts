import fs from "node:fs";
import path from "node:path";

import type { ScaffoldConfig } from "@zealakit/core/ecosystem";

export function validateGoOutput(targetDir: string, config: ScaffoldConfig): string[] {
  const errors: string[] = [];
  const goModPath = path.join(targetDir, "go.mod");
  if (!fs.existsSync(goModPath)) {
    errors.push("go.mod is missing.");
    return errors;
  }

  const goMod = fs.readFileSync(goModPath, "utf-8");
  const moduleLine = goMod
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("module "));
  if (!moduleLine) {
    errors.push("go.mod is missing a module declaration.");
    return errors;
  }

  const modulePath = moduleLine.slice("module ".length).trim();
  if (!modulePath.includes(config.projectName) && modulePath !== config.projectName) {
    errors.push(
      `go.mod module is '${modulePath}', expected it to include project name '${config.projectName}'.`,
    );
  }

  if (fs.existsSync(path.join(targetDir, "package.json"))) {
    errors.push("Go templates must not include package.json.");
  }
  return errors;
}
