import { defineRecipe, nuxtConfigKeys, nuxtModule } from "./define.js";

export default defineRecipe({
  id: "pinia",
  name: "Pinia",
  category: "state",
  supportedScopes: ["client", "hybrid"],
  frameworks: ["vue"],
  exclusive: true,
  packages: {
    pinia: "^4.1.0",
  },
  overlayPackages: {
    nuxt: {
      "@pinia/nuxt": "^1.0.3",
    },
  },
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    "vite-vue": [
      {
        file: "src/main.ts",
        pattern: /import \{ createApp \} from "vue";/,
        replacement: 'import { createApp } from "vue";\nimport { createPinia } from "pinia";',
      },
      {
        file: "src/main.ts",
        pattern: /app\.use\(router\)\.mount\(rootElement\);/,
        replacement: "app.use(createPinia());\napp.use(router).mount(rootElement);",
      },
    ],
    nuxt: [
      nuxtModule("@pinia/nuxt"),
      nuxtConfigKeys('  pinia: {\n    storesDirs: ["./app/stores/**"],\n  },\n'),
    ],
  },
});
