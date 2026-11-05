import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "zustand",
  name: "Zustand",
  category: "state",
  supportedScopes: ["client", "hybrid"],
  frameworks: ["react"],
  exclusive: true,
  packages: {
    zustand: "^5.0.16",
  },
  devDependencies: {},
  scripts: {},
});
