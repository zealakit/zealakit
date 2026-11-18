import path from "node:path";
import { getRecipeDir } from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";
import { addGoRequires, appendEnvSection, mergeGoSum } from "./shared.js";

const GO_MODULES = {
  "github.com/redis/go-redis/v9": "v9.14.0",
} as const;

export default defineGoRecipe({
  id: "redis",
  discovery: {
    capabilities: [],
    projectTypes: ["server-api", "background-worker"],
  },
  name: "Redis",
  hint: "go-redis client + REDIS_URL config",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: false,
  goModules: { ...GO_MODULES },
  finalize(targetDir) {
    addGoRequires(targetDir, GO_MODULES, "Redis");
    mergeGoSum(targetDir, path.join(getRecipeDir("redis"), "scaffold", "go.sum"));
    appendEnvSection(
      targetDir,
      "REDIS_URL",
      `# Redis (go-redis)
REDIS_URL=redis://localhost:6379/0
REDIS_DIAL_TIMEOUT=5s`,
    );
  },
});
