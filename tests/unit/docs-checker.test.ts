import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { PACKAGE_ROOT } from "@zealakit/core/internal";

/**
 * Behavioural tests for the zero-dependency checker shipped with the skill.
 * Each case builds a tiny repository in a temp dir and runs the real script.
 */

const CHECKER = path.join(PACKAGE_ROOT, "recipes/_shared/repo-docs/check-docs.mjs");
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-docs-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;

const VALID_README = `# Demo

Demo app.

## Stack

| Area | Tech |
| ---- | ---- |
| UI   | React |

## Requirements

Node.js 22.

## Getting started

\`\`\`bash
npm install
\`\`\`

## Scripts

| Script | Command       |
| ------ | ------------- |
| dev    | npm run dev   |
| build  | npm run build |

## Environment

| Key        | Required |
| ---------- | -------- |
| PUBLIC_URL | no       |

## Project structure

\`src/\` holds the app.

## Deployment

Build with \`npm run build\`.

## Agent docs

See \`AGENTS.md\`.

## License

MIT.
`;

type Fixture = {
  dir: string;
  profilePath: string;
  write: (relative: string, content: string) => void;
};

function fixture(options: {
  readme?: string;
  languages?: string[];
  linkStyle?: "absolute" | "relative";
  sections?: string[];
  env?: string;
  scripts?: Record<string, string>;
}): Fixture {
  const dir = path.join(workRoot, `case-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  const profile = {
    $schema: "./profile.schema.json",
    projectName: "demo",
    ecosystem: "node",
    packageManager: "npm",
    units: [{ dir: "", name: "demo", layout: "app" }],
    languages: options.languages ?? ["en"],
    linkStyle: options.linkStyle ?? "relative",
    absoluteBase: null,
    cover: null,
    license: "MIT",
    sections: options.sections ?? [],
    docsDir: { enabled: false, pages: [] },
    internalSkills: ".agents/skills",
    userSkills: null,
    check: "npm run docs:check",
  };
  const profilePath = path.join(dir, "profile.json");
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  const write = (relative: string, content: string) => {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write("README.md", options.readme ?? VALID_README);
  write(
    "package.json",
    JSON.stringify({
      name: "demo",
      scripts: options.scripts ?? { dev: "vite", build: "vite build" },
    }),
  );
  write(".env.example", options.env ?? "PUBLIC_URL=https://example.com\n");
  return { dir, profilePath, write };
}

function run(fixtureValue: Fixture) {
  const result = spawnSync(
    process.execPath,
    [CHECKER, "--root", fixtureValue.dir, "--profile", fixtureValue.profilePath],
    { encoding: "utf-8" },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("repo-docs checker", () => {
  it("passes a valid README", () => {
    const result = run(fixture({}));
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a missing required section", () => {
    const result = run(fixture({ readme: VALID_README.replace("## Deployment", "## Deploy") }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing required section "## Deployment"/);
  });

  it("fails on a TODO placeholder", () => {
    const result = run(fixture({ readme: `${VALID_README}\nTODO: document the API.\n` }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TODO/);
  });

  it("enforces absolute links and raw images", () => {
    const readme = `${VALID_README}\n![demo](https://github.com/o/r/blob/main/a.png)\n[docs](docs/a.md)\n`;
    const result = run(fixture({ readme, linkStyle: "absolute" }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /relative link "docs\/a.md"/);
    assert.match(result.stderr, /must end in \?raw=true/);
  });

  it("fails when a profile section is missing", () => {
    const result = run(fixture({ sections: ["database"] }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing section "## Database"/);
  });

  it("fails on environment keys missing from .env.example", () => {
    const result = run(fixture({ env: "OTHER_KEY=1\n" }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PUBLIC_URL" is not in .env.example/);
    assert.match(result.stderr, /OTHER_KEY" is missing from the environment table/);
  });

  it("checks translation parity", () => {
    const value = fixture({ languages: ["en", "vi"] });
    value.write("README_VI.md", "# Demo\n\n## Stack\n\nKhác.\n");
    const result = run(value);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /heading structure differs/);
  });
});
