import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "hookform-zod",
  name: "React Hook Form + Zod",
  hint: "Recommended",
  category: "form",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["react"],
  exclusive: true,
  packages: {
    "react-hook-form": "^7.91.0",
    "@hookform/resolvers": "^7.0.1",
    zod: "^4.6.7",
  },
  devDependencies: {},
  scripts: {},
});
