#!/usr/bin/env node
/**
 * Generic documentation checker for the `repo-docs` skill.
 *
 * Zero dependencies. Reads `profile.json` and `layouts/<layout>.md` from the
 * skill folder, then validates each unit README:
 *
 *   - exactly one H1, equal to the unit name;
 *   - required layout sections present, in order;
 *   - profile `sections` (recipe sections) present;
 *   - link style (`absolute` / `relative`) and `?raw=true` images;
 *   - no links into internal agent skills;
 *   - translation parity (heading levels, code blocks, table shapes);
 *   - scripts / environment tables match the manifest when those sections exist;
 *   - no `TODO` placeholders;
 *   - optional `docs/` pages exist and are linked.
 *
 * Usage:
 *   node check-docs.mjs [--root <dir>] [--profile <file>] [--json] [--quiet]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = "repo-docs";
const SECTION_TITLES = {
  database: "Database",
  docker: "Docker",
  authentication: "Authentication",
  testing: "Testing",
  ci: "CI",
};
const LAYOUTS = new Set(["app", "service", "worker", "cli", "library", "monorepo"]);

const args = process.argv.slice(2);

function flag(name) {
  return args.includes(`--${name}`);
}

function option(name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const ROOT = path.resolve(option("root") ?? process.cwd());
const JSON_OUTPUT = flag("json");
const QUIET = flag("quiet");

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function findProfile() {
  const explicit = option("profile") ?? process.env.DOCS_PROFILE;
  const candidates = [
    explicit,
    path.join(ROOT, ".agents", "skills", SKILL_NAME, "profile.json"),
    path.join(ROOT, "profile.json"),
  ];
  let dir = HERE;
  for (let depth = 0; depth < 4; depth += 1) {
    candidates.push(path.join(dir, "profile.json"));
    dir = path.dirname(dir);
  }
  return firstExisting(candidates);
}

/** Minimal frontmatter reader: `key: value`, `key: [a, b]` and `- item` lists. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  let key;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(result[key])) result[key] = [];
      result[key].push(item[1].trim());
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    key = pair[1];
    const value = pair[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (value === "") {
      result[key] = [];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function stripInline(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

/** Remove Markdown code ticks only — keeps `_` and `-` in identifiers. */
function stripCode(value) {
  return value.replace(/`/g, "").trim();
}

function normalizeTitle(value) {
  return stripInline(value)
    .replace(/[.!:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Split a markdown file into prose lines and fenced code blocks. */
function analyzeMarkdown(raw) {
  const lines = raw.split(/\r?\n/);
  const prose = [];
  const headings = [];
  let fence = null;
  let fencedBlocks = 0;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) {
        fence = marker;
        fencedBlocks += 1;
      } else if (fence === marker) {
        fence = null;
      }
      prose.push("");
      continue;
    }
    if (fence !== null) {
      prose.push("");
      continue;
    }
    prose.push(line);
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      headings.push({ level: heading[1].length, text: stripInline(heading[2]), line });
    }
  }

  return { prose, headings, fencedBlocks, lines };
}

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function collectTables(prose) {
  const tables = [];
  let index = 0;
  while (index < prose.length) {
    if (!/^\s*\|/.test(prose[index])) {
      index += 1;
      continue;
    }
    const start = index;
    const rows = [];
    while (index < prose.length && /^\s*\|/.test(prose[index])) {
      rows.push(splitRow(prose[index]));
      index += 1;
    }
    if (rows.length < 2) continue;
    const separator = rows[1].every((cell) => /^:?-{2,}:?$/.test(cell));
    if (!separator) continue;
    tables.push({
      start,
      header: rows[0],
      rows: rows.slice(2),
      shape: `${rows.length}x${rows[0].length}`,
    });
  }
  return tables;
}

function collectLinks(prose) {
  const links = [];
  const pattern = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  for (const line of prose) {
    for (const match of line.matchAll(pattern)) {
      links.push({ image: match[1] === "!", target: match[3] });
    }
  }
  return links;
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

function readEnvKeys(dir) {
  const file = path.join(dir, ".env.example");
  if (!fs.existsSync(file)) return undefined;
  const keys = new Set();
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*#?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function readScriptNames(dir, ecosystem) {
  try {
    if (ecosystem === "node") {
      const file = path.join(dir, "package.json");
      if (!fs.existsSync(file)) return undefined;
      const manifest = JSON.parse(fs.readFileSync(file, "utf-8"));
      return new Set(Object.keys(manifest.scripts ?? {}));
    }
    if (ecosystem === "go") {
      const file = path.join(dir, "Makefile");
      if (!fs.existsSync(file)) return undefined;
      const names = new Set();
      for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z0-9_.-]+)\s*:(?!=)/);
        if (match) names.add(match[1]);
      }
      return names;
    }
    if (ecosystem === "python") {
      const file = path.join(dir, "pyproject.toml");
      if (!fs.existsSync(file)) return undefined;
      const raw = fs.readFileSync(file, "utf-8");
      const section = raw.match(/^\[project\.scripts\]\s*$([\s\S]*?)(?=^\[|$)/m);
      if (!section) return undefined;
      const names = new Set();
      for (const line of section[1].split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
        if (match) names.add(match[1]);
      }
      return names;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolveLayout(profileDir, layoutId) {
  const candidates = [
    path.join(profileDir, "layouts", `${layoutId}.md`),
    path.join(HERE, "layouts", `${layoutId}.md`),
  ];
  const file = firstExisting(candidates);
  if (!file) {
    return {
      error: `No layout definition for '${layoutId}' (looked in ${candidates.join(", ")}).`,
    };
  }
  return { file, frontmatter: parseFrontmatter(fs.readFileSync(file, "utf-8")) };
}

function checkReadme(options) {
  const { unit, unitDir, file, relative, profile, layout } = options;
  const errors = [];
  const warnings = [];
  const raw = fs.readFileSync(file, "utf-8");
  const analyzed = analyzeMarkdown(raw);
  const { prose, headings, fencedBlocks } = analyzed;

  if (/\bTODO\b/.test(prose.join("\n"))) {
    errors.push(`${relative}: contains a TODO placeholder.`);
  }

  const h1 = headings.filter((heading) => heading.level === 1);
  if (h1.length !== 1) {
    errors.push(`${relative}: expected exactly one H1, found ${h1.length}.`);
  } else if (normalizeTitle(h1[0].text) !== normalizeTitle(unit.name)) {
    errors.push(`${relative}: H1 is "${h1[0].text}" but profile unit name is "${unit.name}".`);
  }

  if (profile.cover && !raw.includes(profile.cover)) {
    errors.push(`${relative}: profile.cover image is not linked.`);
  }

  const h2 = headings.filter((heading) => heading.level === 2).map((heading) => heading.text);
  const required = [
    ...(Array.isArray(layout.frontmatter.required) ? layout.frontmatter.required : []),
    ...(Array.isArray(profile.requiredSections) ? profile.requiredSections : []),
  ];
  const positions = [];
  for (const title of required) {
    const index = h2.findIndex((entry) => normalizeTitle(entry) === normalizeTitle(title));
    if (index < 0) {
      errors.push(`${relative}: missing required section "## ${title}" (${unit.layout}).`);
      continue;
    }
    positions.push({ title, index });
  }
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index].index < positions[index - 1].index) {
      errors.push(
        `${relative}: section "## ${positions[index].title}" must come after "## ${positions[index - 1].title}".`,
      );
    }
  }

  for (const id of profile.sections ?? []) {
    const title = SECTION_TITLES[id];
    if (!title) {
      errors.push(`${relative}: unknown profile section id '${id}'.`);
      continue;
    }
    if (!h2.some((entry) => normalizeTitle(entry) === normalizeTitle(title))) {
      errors.push(`${relative}: missing section "## ${title}" required by profile.sections.`);
    }
  }

  const links = collectLinks(prose);
  for (const link of links) {
    if (link.target.startsWith("#")) continue;
    if (/\.agents\//.test(link.target)) {
      errors.push(`${relative}: links into internal agent skills (${link.target}).`);
    }
    if (profile.linkStyle === "absolute") {
      if (!isExternal(link.target)) {
        errors.push(`${relative}: relative link "${link.target}" (linkStyle: absolute).`);
      } else if (
        link.image &&
        /github\.com\/[^/]+\/[^/]+\/blob\//.test(link.target) &&
        !/[?&]raw=true/.test(link.target)
      ) {
        errors.push(`${relative}: image "${link.target}" must end in ?raw=true.`);
      }
    } else if (!isExternal(link.target)) {
      const clean = link.target.split(/[?#]/)[0];
      const resolved = path.resolve(path.dirname(file), clean);
      if (!fs.existsSync(resolved)) {
        errors.push(`${relative}: relative link "${link.target}" does not resolve.`);
      }
    }
  }

  // Scripts table (only when the layout/README has the section).
  if (h2.some((entry) => normalizeTitle(entry) === "scripts")) {
    const scripts = readScriptNames(unitDir, profile.ecosystem);
    const table = collectTables(prose).find(
      (candidate) => candidate.header[0] && /script|command/i.test(candidate.header[0]),
    );
    if (scripts && table) {
      const documented = new Set(
        table.rows.map((row) => stripInline(row[0] ?? "")).filter(Boolean),
      );
      for (const name of documented) {
        if (!scripts.has(name)) {
          errors.push(`${relative}: scripts table row "${name}" is not in the manifest.`);
        }
      }
      for (const name of scripts) {
        if (!documented.has(name)) {
          warnings.push(`${relative}: manifest script "${name}" is not in the scripts table.`);
        }
      }
    }
  }

  // Environment table vs .env.example (both directions).
  if (h2.some((entry) => normalizeTitle(entry) === "environment")) {
    const envKeys = readEnvKeys(unitDir);
    const table = collectTables(prose).find(
      (candidate) => candidate.header[0] && /variable|key|name/i.test(candidate.header[0]),
    );
    if (envKeys && table) {
      const documented = new Set();
      for (const row of table.rows) {
        const cell = stripCode(row[0] ?? "");
        if (/^[A-Z][A-Z0-9_]*$/.test(cell)) documented.add(cell);
      }
      for (const key of documented) {
        if (!envKeys.has(key)) {
          errors.push(`${relative}: environment key "${key}" is not in .env.example.`);
        }
      }
      for (const key of envKeys) {
        if (!documented.has(key)) {
          errors.push(
            `${relative}: .env.example key "${key}" is missing from the environment table.`,
          );
        }
      }
    }
  }

  // Translation parity: same heading levels, code blocks and table shapes.
  const languages = Array.isArray(profile.languages) ? profile.languages : ["en"];
  if (languages.length > 1) {
    const signature = {
      headings: headings.map((heading) => heading.level).join(","),
      codeBlocks: fencedBlocks,
      tables: collectTables(prose)
        .map((table) => table.shape)
        .join(","),
    };
    for (const language of languages.slice(1)) {
      const translatedRelative = path.join(
        path.dirname(relative),
        `README_${language.toUpperCase()}.md`,
      );
      const translatedFile = path.join(ROOT, translatedRelative);
      if (!fs.existsSync(translatedFile)) {
        errors.push(`${relative}: missing translation ${translatedRelative}.`);
        continue;
      }
      const translated = analyzeMarkdown(fs.readFileSync(translatedFile, "utf-8"));
      const translatedSignature = {
        headings: translated.headings.map((heading) => heading.level).join(","),
        codeBlocks: translated.fencedBlocks,
        tables: collectTables(translated.prose)
          .map((table) => table.shape)
          .join(","),
      };
      if (translatedSignature.headings !== signature.headings) {
        errors.push(
          `${translatedRelative}: heading structure differs from ${relative} (levels: ${translatedSignature.headings} vs ${signature.headings}).`,
        );
      }
      if (translatedSignature.codeBlocks !== signature.codeBlocks) {
        errors.push(
          `${translatedRelative}: ${translatedSignature.codeBlocks} code blocks, expected ${signature.codeBlocks}.`,
        );
      }
      if (translatedSignature.tables !== signature.tables) {
        errors.push(
          `${translatedRelative}: table shapes differ from ${relative} (${translatedSignature.tables} vs ${signature.tables}).`,
        );
      }
    }
  }

  // Optional docs/ pages: exist and are linked from the README.
  if (profile.docsDir?.enabled) {
    for (const page of profile.docsDir.pages ?? []) {
      const pagePath = path.join(ROOT, "docs", page);
      if (!fs.existsSync(pagePath)) {
        errors.push(`${relative}: docsDir page "docs/${page}" does not exist.`);
      }
      const linked = links.some(
        (link) => link.target.includes(`docs/${page}`) || link.target.endsWith(page),
      );
      if (!linked) {
        errors.push(`${relative}: docsDir page "docs/${page}" is not linked.`);
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const profileFile = findProfile();
  if (!profileFile) {
    console.error(
      `No profile.json found. Expected .agents/skills/${SKILL_NAME}/profile.json (or pass --profile).`,
    );
    process.exit(2);
  }
  const profileDir = path.dirname(profileFile);
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(profileFile, "utf-8"));
  } catch (error) {
    console.error(`Could not parse ${profileFile}: ${error.message}`);
    process.exit(2);
  }

  const errors = [];
  const warnings = [];

  if (!Array.isArray(profile.units) || profile.units.length === 0) {
    errors.push("profile.json has no units.");
  }
  for (const unit of profile.units ?? []) {
    if (!LAYOUTS.has(unit.layout)) {
      errors.push(`Unit '${unit.name}' uses unknown layout '${unit.layout}'.`);
      continue;
    }
    const layout = resolveLayout(profileDir, unit.layout);
    if (layout.error) {
      errors.push(layout.error);
      continue;
    }
    const unitDir = path.resolve(ROOT, unit.dir ?? "");
    const readmeName = unit.readme ?? "README.md";
    const file = path.join(unitDir, readmeName);
    const relative = path.relative(ROOT, file) || readmeName;
    if (!fs.existsSync(file)) {
      errors.push(`${relative}: missing (unit '${unit.name}').`);
      continue;
    }
    const result = checkReadme({
      unit,
      unitDir,
      file,
      relative,
      profile,
      layout,
    });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
  } else {
    if (!QUIET || errors.length > 0) {
      for (const error of errors) console.error(`✖ ${error}`);
      for (const warning of warnings) console.error(`⚠ ${warning}`);
    }
    if (errors.length === 0) {
      console.log(`✔ docs OK — ${profile.units?.length ?? 0} unit(s) (${profileFile})`);
    } else {
      console.error(`\n${errors.length} documentation error(s).`);
    }
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
