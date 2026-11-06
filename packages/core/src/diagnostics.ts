import pc from "picocolors";

/** Stable CLI exit codes (CI can treat any non-zero as failure). */
export const ExitCode = {
  /** Success, or user cancelled interactively */
  OK: 0,
  /** Unexpected internal / filesystem failure */
  INTERNAL: 1,
  /** Bad flags or missing required arguments */
  USAGE: 2,
  /** Invalid template/recipe, conflicts, incompatibility, blocked dry-run */
  VALIDATION: 3,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * The scaffold was rejected by validation (preflight plan blockers or the
 * post-generation output checks). Consumers map this to `ExitCode.VALIDATION`
 * instead of treating it as an unexpected internal failure.
 */
export class ScaffoldValidationError extends Error {
  /** Individual validation messages, in the order they were reported. */
  readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = "ScaffoldValidationError";
    this.errors = [...errors];
  }
}

export type Diagnostic = {
  title: string;
  selected?: string[];
  reason?: string;
  resolution?: string;
};

/** Multi-line, actionable error/warning body (no trailing newline). */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [diagnostic.title];
  if (diagnostic.selected && diagnostic.selected.length > 0) {
    lines.push("", "Selected:");
    for (const item of diagnostic.selected) {
      lines.push(`  - ${item}`);
    }
  }
  if (diagnostic.reason) {
    lines.push("", "Reason:", `  ${diagnostic.reason}`);
  }
  if (diagnostic.resolution) {
    lines.push("", "Resolution:", `  ${diagnostic.resolution}`);
  }
  return lines.join("\n");
}

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

export function recipeConflictDiagnostic(category: string, recipeIds: string[]): Diagnostic {
  const names = recipeIds.map((id) => `'${id}'`).join(" and ");
  return {
    title: "Recipe conflict detected",
    selected: recipeIds,
    reason: `Both recipes belong to the exclusive '${category}' category.`,
    resolution: `Choose only one of ${names}.`,
  };
}

export function unknownRecipesDiagnostic(ids: string[]): Diagnostic {
  return {
    title: "Unknown recipe(s)",
    selected: ids,
    reason: "One or more recipe ids are not registered in this zealakit version.",
    resolution: "Check `zealakit info --json` or the CLI --help recipe list for valid ids.",
  };
}

export function unknownTemplateDiagnostic(templateId: string, available: string[]): Diagnostic {
  return {
    title: "Unknown template",
    selected: [templateId],
    reason: `Template '${templateId}' does not exist.`,
    resolution: `Use one of: ${available.join(", ")}.`,
  };
}

export function incompatDiagnostic(
  recipeId: string,
  reason: string,
  alternatives: string[],
): Diagnostic {
  return {
    title: "Recipe incompatible with template",
    selected: [recipeId],
    reason,
    resolution:
      alternatives.length > 0
        ? `Try: ${alternatives.join(", ")}.`
        : "Pick a different recipe or template.",
  };
}

export function missingDependencyDiagnostic(recipeId: string, requiredBy: string): Diagnostic {
  return {
    title: "Missing recipe dependency",
    selected: [recipeId],
    reason: `Recipe '${requiredBy}' declares dependsOn '${recipeId}', but that recipe is not registered.`,
    resolution: "Add the missing recipe to the kit registry, or remove it from dependsOn.",
  };
}

export function circularDependencyDiagnostic(cycle: string[]): Diagnostic {
  return {
    title: "Circular recipe dependency",
    selected: cycle,
    reason: `Dependency cycle: ${cycle.join(" → ")}.`,
    resolution: "Remove or restructure dependsOn so the graph is acyclic.",
  };
}
