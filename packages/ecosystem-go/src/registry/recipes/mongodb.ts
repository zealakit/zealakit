import path from "node:path";
import { getRecipeDir } from "@zealakit/core";
import { defineGoRecipe } from "./define.js";
import { addGoRequires, appendEnvSection, mergeGoSum } from "./shared.js";

const GO_MODULES = {
  "go.mongodb.org/mongo-driver/v2": "v2.8.2",
} as const;

export default defineGoRecipe({
  id: "mongodb",
  name: "MongoDB",
  hint: "official MongoDB Go Driver v2",
  category: "infrastructure",
  supportedScopes: ["server", "infrastructure"],
  exclusive: true,
  packages: {},
  goModules: { ...GO_MODULES },
  devDependencies: {},
  scripts: {},
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
