import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ExitCode,
  formatDiagnostic,
  recipeConflictDiagnostic,
  unknownTemplateDiagnostic,
} from "../../src/diagnostics.js";

describe("formatDiagnostic", () => {
  it("renders title, selected, reason, and resolution", () => {
    const text = formatDiagnostic(recipeConflictDiagnostic("linter", ["biome", "eslint"]));
    assert.match(text, /^Recipe conflict detected/);
    assert.match(text, /Selected:\n {2}- biome\n {2}- eslint/);
    assert.match(text, /Reason:\n {2}Both recipes belong to the exclusive 'linter' category\./);
    assert.match(text, /Resolution:\n {2}Choose only one/);
  });

  it("omits empty optional sections", () => {
    const text = formatDiagnostic({ title: "Invalid usage", reason: "Missing name." });
    assert.equal(text, "Invalid usage\n\nReason:\n  Missing name.");
    assert.doesNotMatch(text, /Selected:/);
    assert.doesNotMatch(text, /Resolution:/);
  });

  it("formats unknown template diagnostics", () => {
    const text = formatDiagnostic(unknownTemplateDiagnostic("nope", ["vite-react", "next"]));
    assert.match(text, /Unknown template/);
    assert.match(text, /vite-react, next/);
  });
});

describe("ExitCode", () => {
  it("keeps stable numeric contracts", () => {
    assert.equal(ExitCode.OK, 0);
    assert.equal(ExitCode.INTERNAL, 1);
    assert.equal(ExitCode.USAGE, 2);
    assert.equal(ExitCode.VALIDATION, 3);
  });
});
