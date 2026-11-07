import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareGoVersions,
  extractGoVersionLabel,
  parseGoVersion,
  satisfiesMinimumGoVersion,
} from "@zealakit/ecosystem-go";

describe("parseGoVersion", () => {
  it("parses go-prefixed and plain versions", () => {
    assert.deepEqual(parseGoVersion("go1.24.0"), { major: 1, minor: 24, patch: 0 });
    assert.deepEqual(parseGoVersion("1.25.1"), { major: 1, minor: 25, patch: 1 });
    assert.deepEqual(parseGoVersion("go1.23"), { major: 1, minor: 23, patch: 0 });
  });

  it("rejects invalid input", () => {
    assert.equal(parseGoVersion(""), undefined);
    assert.equal(parseGoVersion("not-a-version"), undefined);
    assert.equal(parseGoVersion("go"), undefined);
  });
});

describe("extractGoVersionLabel", () => {
  it("extracts labels from go version stdout", () => {
    assert.equal(extractGoVersionLabel("go version go1.24.0 darwin/arm64"), "go1.24.0");
    assert.equal(extractGoVersionLabel("go version go1.25.1 linux/amd64"), "go1.25.1");
    assert.equal(extractGoVersionLabel("go version go1.23.5 windows/amd64"), "go1.23.5");
  });

  it("returns undefined for malformed output", () => {
    assert.equal(extractGoVersionLabel("something else"), undefined);
  });
});

describe("compareGoVersions / satisfiesMinimumGoVersion", () => {
  it("compares equal versions", () => {
    assert.equal(
      compareGoVersions({ major: 1, minor: 22, patch: 0 }, { major: 1, minor: 22, patch: 0 }),
      0,
    );
    assert.equal(satisfiesMinimumGoVersion("1.22.0", "1.22.0"), true);
  });

  it("compares higher minor and patch", () => {
    assert.ok(
      compareGoVersions({ major: 1, minor: 23, patch: 0 }, { major: 1, minor: 22, patch: 0 }) > 0,
    );
    assert.ok(
      compareGoVersions({ major: 1, minor: 22, patch: 5 }, { major: 1, minor: 22, patch: 0 }) > 0,
    );
    assert.equal(satisfiesMinimumGoVersion("go1.23.0", "1.22.0"), true);
  });

  it("compares lower versions", () => {
    assert.ok(
      compareGoVersions({ major: 1, minor: 21, patch: 0 }, { major: 1, minor: 22, patch: 0 }) < 0,
    );
    assert.equal(satisfiesMinimumGoVersion("1.21.9", "1.22.0"), false);
  });

  it("compares different majors", () => {
    assert.ok(
      compareGoVersions({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 99, patch: 99 }) > 0,
    );
    assert.equal(satisfiesMinimumGoVersion("2.0.0", "1.22.0"), true);
  });

  it("returns false for invalid version input", () => {
    assert.equal(satisfiesMinimumGoVersion("nope", "1.22.0"), false);
    assert.equal(satisfiesMinimumGoVersion("1.22.0", "nope"), false);
  });

  it("does not compare lexicographically", () => {
    // Lexicographic "go1.9.0" > "go1.22.0" would be wrong; numeric compare must win.
    assert.equal(satisfiesMinimumGoVersion("1.9.0", "1.22.0"), false);
    assert.equal(satisfiesMinimumGoVersion("1.22.0", "1.9.0"), true);
  });
});
