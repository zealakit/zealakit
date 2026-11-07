/** Directory / module segment rules for Go scaffolds (also accepts dotted module paths). */
const GO_NAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)(?:\/(?:[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?))*$/;

const RESERVED = new Set([".", "..", "node_modules", "vendor", "internal", "pkg", "cmd"]);

export function isValidGoProjectName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 214 &&
    name === name.toLowerCase() &&
    !RESERVED.has(name) &&
    GO_NAME_PATTERN.test(name)
  );
}
