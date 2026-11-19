import path from "node:path";
import { getRecipeDir } from "@zealakit/core/ecosystem";
import { defineGoRecipe } from "./define.js";
import { addGoRequires, appendEnvSection, mergeGoSum } from "./shared.js";

const GO_MODULES = {
  "go.mongodb.org/mongo-driver/v2": "v2.8.2",
} as const;

export default defineGoRecipe({
  id: "mongodb",
  discovery: { capabilities: [], projectTypes: ["server-api", "background-worker"] },
  name: "MongoDB",
  hint: "official MongoDB Go Driver v2",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  goModules: { ...GO_MODULES },
  finalize(targetDir) {
    addGoRequires(targetDir, GO_MODULES, "MongoDB");
    mergeGoSum(targetDir, path.join(getRecipeDir("mongodb"), "scaffold", "go.sum"));
    appendEnvSection(
      targetDir,
      "MONGODB_URI",
      `# MongoDB (official Go Driver v2)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=app
MONGODB_CONNECT_TIMEOUT=5s
MONGODB_OPERATION_TIMEOUT=10s`,
    );
  },
});
