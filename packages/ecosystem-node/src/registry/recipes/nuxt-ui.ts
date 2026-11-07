import { defineRecipe, nuxtModule } from "./define.js";

export default defineRecipe({
  id: "nuxt-ui",
  name: "Nuxt UI",
  category: "ui",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["vue"],
  exclusive: true,
  packages: {
    "@nuxt/ui": "^4.12.0",
    tailwindcss: "^4.3.3",
  },
  overlayPackages: {},
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    "vite-vue": [
      {
        file: "src/main.ts",
        pattern: /import \{ createApp \} from "vue";/,
        replacement: 'import { createApp } from "vue";\nimport ui from "@nuxt/ui/vue-plugin";',
      },
      {
        file: "src/main.ts",
        pattern: /app\.use\(router\)\.mount\(rootElement\);/,
        replacement: "app.use(ui);\napp.use(router).mount(rootElement);",
      },
      {
        file: "package.json",
        pattern: /"build": "vue-tsc -b && vite build"/,
        replacement: '"build": "vite build && vue-tsc -b --noEmit"',
      },
    ],
    nuxt: [nuxtModule("@nuxt/ui")],
  },
});
