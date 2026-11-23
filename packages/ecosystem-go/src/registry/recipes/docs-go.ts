import { type FinalizeContext, writeDocsProfile } from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";

/** Write the repo-specific `profile.json` for the `repo-docs` skill. */
function finalizeDocs(targetDir: string, { config }: FinalizeContext): void {
  writeDocsProfile(targetDir, config, { check: null });
}

export default defineGoRecipe({
  id: "docs-go",
  discovery: { capabilities: [], alwaysRelevant: true },
  name: "Docs skill",
  hint: "Agent-ready README + docs system (repo-docs skill)",
  category: "documentation",
  supportedScopes: "all",
  finalize: finalizeDocs,
});
