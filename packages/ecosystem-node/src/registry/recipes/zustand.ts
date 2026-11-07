import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "zustand",
  name: "Zustand",
  category: "state",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["react"],
  exclusive: true,
  packages: {
    zustand: "^5.0.16",
  },
  devDependencies: {},
  scripts: {},
});
