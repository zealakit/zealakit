import type { ValidationResult } from "../types.js";

const NPM_NAME_PATTERN = /^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const RESERVED_NAMES = new Set([
  "node_modules",
  "favicon.ico",
  "package.json",
  "package-lock.json",
]);

export function isValidNpmPackageName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 214 &&
    name === name.toLowerCase() &&
    !name.startsWith(".") &&
    !name.startsWith("_") &&
    !RESERVED_NAMES.has(name) &&
    NPM_NAME_PATTERN.test(name)
  );
}

export function validateProjectName(name: string): ValidationResult {
  if (!name.trim()) {
    return { valid: false, errors: ["Project name cannot be empty."] };
  }

  if (!isValidNpmPackageName(name)) {
    return {
      valid: false,
      errors: [
        `Project name "${name}" is invalid. Names must follow npm naming rules (lowercase, no spaces, cannot start with "." or "_").`,
      ],
    };
  }

  return { valid: true, errors: [] };
}
