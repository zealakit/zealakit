import { defineRecipe } from "./define.js";

export default defineRecipe({
  id: "client-shared-pieces",
  name: "Client shared pieces",
  category: "utils",
  supportedScopes: ["client", "hybrid"],
  default: true,
  packages: {},
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    "vite-react": [
      {
        file: "src/main.tsx",
        pattern: /import App from "\.\/app";/,
        replacement: 'import App from "./app";\nimport "./configs/i18n";',
      },
    ],
    "vite-vue": [
      {
        file: "src/main.ts",
        pattern: /import \{ createApp \} from "vue";/,
        replacement:
          'import { createApp } from "vue";\nimport { installI18n } from "./configs/i18n";',
      },
      {
        file: "src/main.ts",
        pattern: /createApp\(App\)\.use\(router\)\.mount\(rootElement\);/,
        replacement:
          "const app = createApp(App);\ninstallI18n(app);\napp.use(router).mount(rootElement);",
      },
    ],
  },
});
