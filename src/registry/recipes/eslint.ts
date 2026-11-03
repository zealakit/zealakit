import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "eslint",
  name: "ESLint",
  hint: "Flat Config",
  category: "linter",
  supportedScopes: ["client", "server", "hybrid"],
  exclusive: true,
  packages: {},
  devDependencies: {
    eslint: "^10.14.0",
    "@eslint/js": "^10.0.1",
    "typescript-eslint": "^8.72.1",
    globals: "^17.14.0",
  },
  overlayDevDependencies: {
    "vite-react": {
      "eslint-plugin-react-hooks": "^7.1.1",
      "eslint-plugin-react-refresh": "^0.5.7",
    },
    next: {
      "eslint-plugin-react-hooks": "^7.1.1",
      "eslint-plugin-react-refresh": "^0.5.7",
    },
    "vite-vue": {
      "eslint-plugin-vue": "^10.12.0",
    },
    nuxt: {
      "eslint-plugin-vue": "^10.12.0",
    },
  },
  scripts: {
    lint: "eslint .",
    "lint:fix": "eslint . --fix",
  },
});
