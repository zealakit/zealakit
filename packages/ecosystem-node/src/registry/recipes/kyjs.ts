import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "kyjs",
  discovery: { capabilities: ["external-api"], projectTypes: ["ui"] },
  name: "Ky",
  hint: "Lightweight fetch wrapper",
  category: "fetcher",
  supportedScopes: ["client", "hybrid"],
  exclusive: true,
  packages: {
    ky: "^2.2.0",
  },
  devDependencies: {},
  scripts: {},
});
