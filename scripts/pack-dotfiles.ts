import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACKED_DOTFILES } from "../src/scaffold/copy.js";

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

for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  for (const [dotfile, packedName] of Object.entries(PACKED_DOTFILES)) {
    const source = path.join(templatesDir, entry.name, dotfile);
    const packed = path.join(templatesDir, entry.name, packedName);
    if (mode === "add" && fs.existsSync(source)) {
      fs.copyFileSync(source, packed);
    }
    if (mode === "remove") {
      fs.rmSync(packed, { force: true });
    }
  }
}
