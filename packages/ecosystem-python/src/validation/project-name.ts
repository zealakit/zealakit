/** Distribution names per PEP 508/503: letters, digits, `-`, `_`, `.`; start and end alphanumeric. */
const PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function isValidPythonProjectName(name: string): boolean {
  return name.length > 0 && name.length <= 100 && PATTERN.test(name);
}
