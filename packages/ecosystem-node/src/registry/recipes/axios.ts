import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "axios",
  discovery: { capabilities: ["external-api"], projectTypes: ["ui"] },
  name: "Axios",
  category: "fetcher",
  supportedScopes: ["client", "hybrid"],
  exclusive: true,
  packages: {
    axios: "^1.21.0",
  },
  devDependencies: {},
  scripts: {},
});
