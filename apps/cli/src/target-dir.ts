import { cancel, confirm, isCancel } from "@clack/prompts";
import {
  checkTargetDirectory,
  nonEmptyTargetMessage,
  type OverwritePolicy,
  type ValidationResult,
} from "@zealakit/core/internal";

import type { CliOptions } from "./options.js";

/**
 * Decide the overwrite policy for the destination. The CLI owns the prompt:
 * `--force` allows, `-y` refuses, otherwise ask. Returns the policy to hand to
 * core, or a failed result when the user declines.
 */
export async function resolveOverwritePolicy(
  projectName: string,
  cwd: string,
  options: Pick<CliOptions, "yes" | "force">,
): Promise<{ policy: OverwritePolicy; result: ValidationResult }> {
  const ok = { valid: true, errors: [] };
  if (checkTargetDirectory(projectName, cwd).status === "empty") {
    return { policy: "refuse", result: ok };
  }
  if (options.force) {
    return { policy: "allow", result: ok };
  }
  if (options.yes) {
    return {
      policy: "refuse",
      result: {
        valid: false,
        errors: [
          `${nonEmptyTargetMessage(projectName)} Re-run without -y to confirm overwrite, or use --force.`,
        ],
      },
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
    ? { policy: "allow", result: ok }
    : {
        policy: "refuse",
        result: {
          valid: false,
          errors: ["Scaffold cancelled because the target directory already exists."],
        },
      };
}
