import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "vee-validate-zod",
  name: "VeeValidate + Zod",
  hint: "Recommended",
  category: "form",
  supportedScopes: ["client", "hybrid"],
  frameworks: ["vue"],
  exclusive: true,
  packages: {
    "vee-validate": "^4.15.1",
    "@vee-validate/zod": "^4.15.1",
    zod: "^3.25.76",
  },
  devDependencies: {},
  scripts: {},
});
