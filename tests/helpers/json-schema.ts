/**
 * Tiny JSON Schema (draft-07 subset) validator for the contract tests:
 * type, const, enum, required, properties, additionalProperties, items, oneOf.
 * Returns human-readable error paths; an empty array means valid.
 */
type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  oneOf?: Schema[];
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function validateJsonSchema(value: unknown, schema: Schema, at = "$"): string[] {
  const errors: string[] = [];

  if (schema.oneOf) {
    const results = schema.oneOf.map((option) => validateJsonSchema(value, option, at));
    const matches = results.filter((result) => result.length === 0).length;
    if (matches !== 1) {
      errors.push(
        `${at}: expected exactly one oneOf branch to match, ${matches} did (${results.map((r) => r[0]).join(" | ")})`,
      );
    }
    return errors;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${at}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = allowed.some((t) => t === actual || (t === "integer" && Number.isInteger(value)));
    if (!ok) {
      errors.push(`${at}: expected ${allowed.join("|")}, got ${actual}`);
      return errors;
    }
  }
  if (typeOf(value) === "object") {
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in object)) errors.push(`${at}: missing required '${key}'`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in object) errors.push(...validateJsonSchema(object[key], child, `${at}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in (schema.properties ?? {}))) errors.push(`${at}: unexpected '${key}'`);
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(...validateJsonSchema(item, schema.items as Schema, `${at}[${index}]`));
    });
  }
  return errors;
}
