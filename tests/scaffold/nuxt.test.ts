import { templateSuite } from "../helpers/cases.js";

templateSuite("nuxt", {
  pass: [
    {
      name: "biome + pinia + vee-validate-zod + kyjs + storybook",
      recipes: ["biome", "pinia", "vee-validate-zod", "kyjs", "storybook"],
      exists: [
        "app/pages/index.vue",
        "app/general.d.ts",
        "app/layouts/default.vue",
        "app/layouts/entry.vue",
        "app/layouts/console.vue",
        "app/pages/feature-a/index.vue",
        "server/api/health.get.ts",
        "biome.json",
        "app/stores/something.store.ts",
        "app/lib/schemas/example.schema.ts",
        "app/lib/fetcher/index.ts",
        ".storybook/main.ts",
        ".agents/skills/nuxt/SKILL.md",
        "i18n/locales/en.ts",
        "i18n/locales/en/common.json",
      ],
      absent: ["app/hooks"],
      deps: ["nuxt", "vue", "@nuxtjs/i18n", "pinia", "@pinia/nuxt", "vee-validate", "ky"],
      noDeps: ["react"],
      devDeps: ["@storybook/vue3-vite"],
      contains: {
        "nuxt.config.ts": ['"@nuxtjs/i18n"', '"@pinia/nuxt"', 'storesDirs: ["./app/stores/**"]'],
      },
      excludes: { "nuxt.config.ts": ['"./src'] },
    },
    {
      name: "shadcn-vue + pinia",
      recipes: ["shadcn-vue", "pinia"],
      exists: [
        "app/components/ui/button/index.ts",
        "app/components/ui/button/Button.vue",
        "app/assets/css/main.css",
        "components.json",
      ],
      // A root ui/index.ts breaks Nuxt component resolvePath.
      absent: ["app/components/ui/index.ts"],
      deps: ["reka-ui", "shadcn-nuxt", "@pinia/nuxt"],
      noDeps: ["react"],
      contains: {
        "app/lib/utils/index.ts": ['export * from "./other"'],
        "nuxt.config.ts": [
          "@tailwindcss/vite",
          '"shadcn-nuxt"',
          '"@pinia/nuxt"',
          'componentDir: "./app/components/ui"',
        ],
        "components.json": ["app/assets/css/main.css"],
        "app/assets/css/main.css": ['@import "tailwindcss"'],
      },
    },
    {
      name: "nuxt-ui + pinia",
      recipes: ["nuxt-ui", "pinia"],
      exists: ["app/app.vue", "app/assets/css/main.css"],
      noDeps: ["react"],
      contains: {
        "app/app.vue": ["<UApp>"],
        "nuxt.config.ts": ['"@nuxt/ui"', '"@pinia/nuxt"'],
        "app/assets/css/main.css": ['@import "@nuxt/ui"'],
      },
    },
    {
      name: "drizzle-orm (hybrid ORM)",
      recipes: ["drizzle-orm"],
      exists: [
        "server/persistence/drizzle/drizzle.bootstrap.ts",
        "server/persistence/drizzle/drizzle.client.ts",
        "drizzle.config.ts",
      ],
      absent: ["server/persistence/drizzle/drizzle.module.ts", "app/infrastructure", "src"],
      contains: {
        "AGENTS.md": [".agents/skills/drizzle-orm/SKILL.md"],
        "drizzle.config.ts": [
          "./server/persistence/drizzle/schema.ts",
          "./server/persistence/drizzle/migrations",
        ],
      },
    },
  ],
  reject: [
    { name: "antd (react)", recipes: ["antd"] },
    { name: "zustand (react)", recipes: ["zustand"] },
  ],
});
