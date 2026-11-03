import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insertAgentEntry } from "../../src/scaffold/agent-docs.js";
import { transformSource } from "../../src/scaffold/transforms.js";

describe("transformSource", () => {
  it("appends a missing line once", () => {
    const once = transformSource("r", { file: "f", append: 'export * from "./other";' }, "a\n");
    assert.equal(once, 'a\nexport * from "./other";\n');
    assert.equal(
      transformSource("r", { file: "f", append: 'export * from "./other";' }, once),
      once,
    );
  });

  it("rejects an empty append", () => {
    assert.throws(() => transformSource("r", { file: "f", append: "  " }, "a"), /is empty/);
  });

  it("replaces a matching pattern", () => {
    const next = transformSource(
      "r",
      { file: "f", pattern: /<App \/>/g, replacement: "<P><App /></P>" },
      "<App />",
    );
    assert.equal(next, "<P><App /></P>");
  });

  it("throws when the pattern does not match", () => {
    assert.throws(
      () => transformSource("mui", { file: "main.tsx", pattern: /nope/, replacement: "x" }, "a"),
      /Recipe 'mui' transform did not match in main.tsx/,
    );
  });

  it("requires append or pattern + replacement", () => {
    assert.throws(() => transformSource("r", { file: "f" }, "a"), /needs either append/);
  });
});

describe("insertAgentEntry", () => {
  const entry = "- **Forms:** [x](.agents/skills/x/SKILL.md)";

  it("inserts after the Structure bullet", () => {
    const raw = "# A\n\n- **Structure:** see docs\n- other\n";
    assert.equal(
      insertAgentEntry(raw, entry),
      `# A\n\n- **Structure:** see docs\n${entry}\n- other\n`,
    );
  });

  it("falls back to the Always follow heading", () => {
    const raw = "## Always follow\n\n- other\n";
    assert.equal(insertAgentEntry(raw, entry), `## Always follow\n\n${entry}\n- other\n`);
  });

  it("appends at the end otherwise and never duplicates", () => {
    const once = insertAgentEntry("# A\n", entry);
    assert.equal(once, `# A\n\n${entry}\n`);
    assert.equal(insertAgentEntry(once, entry), once);
  });
});
