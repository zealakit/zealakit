import "../register.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insertAgentEntry, transformSource } from "@zealakit/core/internal";

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

describe("marker and json transforms", () => {
  it("inserts after the marker line using its indentation", () => {
    const next = transformSource(
      "r",
      { file: "f", marker: "// zealakit-modules", insert: '"a",' },
      "export default {\n  modules: [\n    // zealakit-modules\n  ],\n};\n",
    );
    assert.equal(
      next,
      'export default {\n  modules: [\n    // zealakit-modules\n    "a",\n  ],\n};\n',
    );
  });

  it("supports inserting before the marker and fails loudly when it is missing", () => {
    assert.equal(
      transformSource("r", { file: "f", marker: "M", insert: "x", position: "before" }, "a\n  M\n"),
      "a\n  x\n  M\n",
    );
    assert.throws(
      () => transformSource("r", { file: "f", marker: "M", insert: "x" }, "nothing"),
      /marker 'M' not found in f/,
    );
  });

  it("edits JSON structurally regardless of formatting", () => {
    const raw = '{"compilerOptions":{"strict":true,"paths":{"@/*":["./src/*"]}}}';
    const next = transformSource(
      "r",
      {
        file: "tsconfig.json",
        json: (data) => {
          (data.compilerOptions as Record<string, unknown>).experimentalDecorators = true;
        },
      },
      raw,
    );
    assert.equal(
      next,
      '{\n  "compilerOptions": {\n    "strict": true,\n    "paths": {\n      "@/*": ["./src/*"]\n    },\n    "experimentalDecorators": true\n  }\n}\n',
    );
    assert.throws(
      () => transformSource("r", { file: "x.json", json: () => {} }, "{ nope"),
      /not valid JSON/,
    );
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
