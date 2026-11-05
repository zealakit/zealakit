import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACKED_DOTFILES } from "@zealakit/core";

/**
 * npm never packs `.gitignore`, so templates ship a `_gitignore` twin that the
 * scaffolder renames back. `add` runs on prepack, `remove` on postpack.
 */
const mode = process.argv[2];
if (mode !== "add" && mode !== "remove") {
  console.error("Usage: tsx scripts/pack-dotfiles.ts <add|remove>");
  process.exit(1);
}

const templatesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates");

function eachTemplateDir(callback: (templateDir: string) => void): void {
  for (const ecosystem of fs.readdirSync(templatesDir, { withFileTypes: true })) {
    if (!ecosystem.isDirectory()) continue;
    // Skip reserved placeholder trees without real templates.
    if (ecosystem.name === "go") continue;
    const ecosystemDir = path.join(templatesDir, ecosystem.name);
    for (const entry of fs.readdirSync(ecosystemDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      callback(path.join(ecosystemDir, entry.name));
    }
  }
}

eachTemplateDir((templateDir) => {
  for (const [dotfile, packedName] of Object.entries(PACKED_DOTFILES)) {
    const source = path.join(templateDir, dotfile);
    const packed = path.join(templateDir, packedName);
    if (mode === "add" && fs.existsSync(source)) {
      fs.copyFileSync(source, packed);
    }
    if (mode === "remove") {
      fs.rmSync(packed, { force: true });
    }
  }
});
