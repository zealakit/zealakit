import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "axios",
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
