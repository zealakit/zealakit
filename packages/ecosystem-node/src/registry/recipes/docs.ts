import {
  copyDocsChecker,
  docsCheckCommand,
  type FinalizeContext,
  writeDocsProfile,
} from "@zealakit/core/ecosystem";
import { defineRecipe } from "./define.js";

/** Write the repo-specific `profile.json` and ship the checker to `scripts/`. */
function finalizeDocs(targetDir: string, { config }: FinalizeContext): void {
  const profile = writeDocsProfile(targetDir, config, {
    check: docsCheckCommand(config.packageManager ?? "npm"),
  });
  if (profile) {
    copyDocsChecker(targetDir);
  }
}

export default defineRecipe({
  id: "docs",
  discovery: { capabilities: [], alwaysRelevant: true },
  name: "Docs skill",
  hint: "Agent-ready README + docs system (repo-docs skill)",
  category: "documentation",
  supportedScopes: "all",
  scripts: {
    "docs:check": "node scripts/check-docs.mjs",
  },
  finalize: finalizeDocs,
});
