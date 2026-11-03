import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertScaffoldInvariants,
  expectRejected,
  type ScaffoldedApp,
  scaffold,
} from "./scaffold.js";

/**
 * Declarative scaffold expectation. Package versions/scripts declared by the
 * selected recipes are already checked by `assertScaffoldInvariants`; list
 * here only what is specific to the combination.
 */
export type ScaffoldCase = {
  name: string;
  recipes: string[];
  exists?: string[];
  absent?: string[];
  deps?: string[];
  noDeps?: string[];
  devDeps?: string[];
  noDevDeps?: string[];
  scripts?: Record<string, string>;
  noScripts?: string[];
  /** File → substrings that must appear */
  contains?: Record<string, string[]>;
  /** File → substrings that must not appear */
  excludes?: Record<string, string[]>;
  check?: (app: ScaffoldedApp) => void;
};

export type RejectCase = {
  name: string;
  recipes: string[];
  /** Patterns the validation output must match */
  output?: RegExp[];
};

function assertCase(app: ScaffoldedApp, spec: ScaffoldCase): void {
  assertScaffoldInvariants(app);

  for (const file of spec.exists ?? []) {
    assert.ok(app.exists(file), `${file} should exist`);
  }
  for (const file of spec.absent ?? []) {
    assert.ok(!app.exists(file), `${file} should not exist`);
  }

  const pkg = app.pkg();
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const scripts = pkg.scripts ?? {};
  for (const name of spec.deps ?? []) assert.ok(name in deps, `dependency ${name} expected`);
  for (const name of spec.noDeps ?? []) assert.ok(!(name in deps), `dependency ${name} unexpected`);
  for (const name of spec.devDeps ?? [])
    assert.ok(name in devDeps, `devDependency ${name} expected`);
  for (const name of spec.noDevDeps ?? []) {
    assert.ok(!(name in devDeps), `devDependency ${name} unexpected`);
  }
  for (const [name, command] of Object.entries(spec.scripts ?? {})) {
    assert.equal(scripts[name], command, `script ${name}`);
  }
  for (const name of spec.noScripts ?? [])
    assert.ok(!(name in scripts), `script ${name} unexpected`);

  for (const [file, needles] of Object.entries(spec.contains ?? {})) {
    const content = app.read(file);
    for (const needle of needles) {
      assert.ok(content.includes(needle), `${file} should contain ${JSON.stringify(needle)}`);
    }
  }
  for (const [file, needles] of Object.entries(spec.excludes ?? {})) {
    const content = app.read(file);
    for (const needle of needles) {
      assert.ok(!content.includes(needle), `${file} should not contain ${JSON.stringify(needle)}`);
    }
  }

  spec.check?.(app);
}

/** One `describe` per template; filter with `--test-name-pattern "next"` or a case name. */
export function templateSuite(
  templateId: string,
  cases: { pass: ScaffoldCase[]; reject?: RejectCase[] },
): void {
  describe(templateId, () => {
    for (const spec of cases.pass) {
      it(`${templateId}: ${spec.name}`, async () => {
        assertCase(await scaffold(templateId, spec.recipes), spec);
      });
    }

    for (const spec of cases.reject ?? []) {
      it(`${templateId}: rejects ${spec.name}`, () => {
        const output = expectRejected(templateId, spec.recipes);
        for (const pattern of spec.output ?? []) {
          assert.match(output, pattern);
        }
      });
    }
  });
}
