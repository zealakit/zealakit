import { type Diagnostic, ExitCode, formatDiagnostic } from "@zealakit/core/internal";
import pc from "picocolors";

/** CLI-owned terminal output. Core stays free of colors, prompts and `process.exit`. */

export function printError(message: string): void {
  console.error(pc.red(message));
}

export function printWarning(message: string): void {
  console.error(pc.yellow(message));
}

export function printInfo(message: string): void {
  console.log(message);
}

export function fail(message: string, code: ExitCode = ExitCode.INTERNAL): never {
  printError(message);
  process.exit(code);
}

export function failDiagnostic(
  diagnostic: Diagnostic,
  code: ExitCode = ExitCode.VALIDATION,
): never {
  fail(formatDiagnostic(diagnostic), code);
}

export function printValidationErrors(errors: string[]): void {
  for (const [index, error] of errors.entries()) {
    if (index > 0) {
      console.error();
    }
    printError(error);
  }
}
