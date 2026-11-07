import fs from "node:fs";
import { assertStagingRealPath, resolveStagingPath } from "@zealakit/core";
import { defineRecipe } from "./define.js";

/**
 * Recipe biome.json files set `root: false` so they can live nested inside the
 * zealakit repo; scaffolded projects must own their root config.
 */
function dropNestedRootFlag(targetDir: string): void {
  // `finalize` receives the staging root; keep the read/write inside it.
  const biomeConfigPath = resolveStagingPath(targetDir, "biome.json");
  if (!fs.existsSync(biomeConfigPath)) {
    return;
  }
  assertStagingRealPath(targetDir, biomeConfigPath);

  const biomeConfig = JSON.parse(fs.readFileSync(biomeConfigPath, "utf-8")) as Record<
    string,
    unknown
  >;
  delete biomeConfig.root;
  fs.writeFileSync(biomeConfigPath, `${JSON.stringify(biomeConfig, null, 2)}\n`, "utf-8");
}

export default defineRecipe({
  id: "biome",
  name: "Biome",
  hint: "Fast, all-in-one — recommended",
  category: "linter",
  supportedScopes: ["client", "server", "hybrid"],
  exclusive: true,
  packages: {},
  devDependencies: {
    "@biomejs/biome": "^2.6.4",
  },
  scripts: {
    check: "biome check .",
    "check:write": "biome check --write .",
    format: "biome format --write .",
  },
  finalize: dropNestedRootFlag,
});
