import { templateSuite } from "../helpers/cases.js";

templateSuite("vite-vue", {
  pass: [
    {
      name: "biome + nanostores + vee-validate-zod + kyjs + storybook",
      recipes: ["biome", "nanostores", "vee-validate-zod", "kyjs", "storybook"],
      exists: [
        "src/app/router/index.ts",
        "src/configs/i18n.ts",
        "src/app/features/feature-a/composables",
        "biome.json",
        "src/lib/schemas/example.schema.ts",
        ".agents/skills/vee-validate-zod/SKILL.md",
        ".storybook/main.ts",
      ],
      absent: ["src/hooks"],
      deps: ["vue", "vue-router", "nanostores", "@nanostores/vue", "vee-validate", "ky"],
      noDeps: ["@nanostores/react", "react"],
      devDeps: ["@storybook/vue3-vite"],
      contains: {
        "src/main.ts": ['import { installI18n } from "./configs/i18n";', "installI18n(app)"],
      },
    },
    {
      name: "pinia",
      recipes: ["pinia"],
      exists: ["src/stores/something.store.ts"],
      contains: {
        "src/main.ts": ['import { createPinia } from "pinia";', "app.use(createPinia())"],
      },
    },
    {
      name: "shadcn-vue",
      recipes: ["shadcn-vue"],
      exists: [
        "src/components/ui/button/index.ts",
        "src/components/ui/button/Button.vue",
        "src/styles/globals.css",
        "components.json",
        "src/lib/utils/other.ts",
        ".agents/skills/shadcn-vue/SKILL.md",
      ],
      noDeps: ["react", "shadcn"],
      contains: {
        "src/lib/utils/index.ts": ['export * from "./other"'],
        "vite.config.ts": ["@tailwindcss/vite", "@vitejs/plugin-vue"],
        "components.json": ['"style": "new-york"', "src/styles/globals.css"],
        "src/styles/globals.css": ['@import "tailwindcss"'],
      },
    },
    {
      name: "nuxt-ui + pinia",
      recipes: ["nuxt-ui", "pinia"],
      exists: ["vite.config.ts", "src/styles/globals.css", ".agents/skills/nuxt-ui/SKILL.md"],
      noDeps: ["react"],
      scripts: { build: "vite build && vue-tsc -b --noEmit" },
      contains: {
        "vite.config.ts": ["@nuxt/ui/vite", "@vitejs/plugin-vue"],
        "src/main.ts": [
          'import ui from "@nuxt/ui/vue-plugin"',
          "app.use(ui)",
          "app.use(createPinia())",
        ],
        "src/app/index.vue": ["<UApp>"],
        "index.html": ['class="isolate"'],
        "src/styles/globals.css": ['@import "@nuxt/ui"'],
      },
    },
  ],
  reject: [
    { name: "antd (react)", recipes: ["antd"], output: [/targets react/] },
    { name: "zustand (react)", recipes: ["zustand"], output: [/Try: pinia, nanostores/] },
    { name: "hookform-zod (react)", recipes: ["hookform-zod"], output: [/vee-validate-zod/] },
    {
      name: "nuxt-ui + shadcn-vue",
      recipes: ["nuxt-ui", "shadcn-vue"],
      output: [/conflict/i, /exclusive 'ui'/],
    },
  ],
});
