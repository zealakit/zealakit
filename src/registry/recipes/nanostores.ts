import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "nanostores",
  name: "Nanostores",
  category: "state",
  supportedScopes: ["client", "hybrid"],
  exclusive: true,
  packages: {
    nanostores: "^1.5.5",
  },
  overlayPackages: {
    "vite-react": {
      "@nanostores/react": "^2.0.1",
    },
    next: {
      "@nanostores/react": "^2.0.1",
    },
    "vite-vue": {
      "@nanostores/vue": "^1.1.0",
    },
    nuxt: {
      "@nanostores/vue": "^1.1.0",
    },
  },
  devDependencies: {},
  scripts: {},
});
