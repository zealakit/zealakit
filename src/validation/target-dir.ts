import fs from "node:fs";
import path from "node:path";
import { cancel, confirm, isCancel } from "@clack/prompts";
import type { CliOptions, ValidationResult } from "../types.js";

export function directoryHasFiles(targetDir: string): boolean {
  return fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0;
}

/** Asks before overwriting a non-empty directory; `-y` refuses instead of overwriting. */
export async function validateTargetDirectory(
  projectName: string,
  cwd: string,
  options: Pick<CliOptions, "yes">,
): Promise<ValidationResult> {
  if (!directoryHasFiles(path.resolve(cwd, projectName))) {
    return { valid: true, errors: [] };
  }

  if (options.yes) {
    return {
      valid: false,
      errors: [
        `Directory "${projectName}" already exists and is not empty. Re-run without -y to confirm overwrite, or choose a different name.`,
      ],
    };
  }

  const shouldOverwrite = await confirm({
    message: `Directory "${projectName}" already exists. Overwrite?`,
    initialValue: false,
  });

  if (isCancel(shouldOverwrite)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  return shouldOverwrite
    ? { valid: true, errors: [] }
    : {
        valid: false,
        errors: ["Scaffold cancelled because the target directory already exists."],
      };
}
