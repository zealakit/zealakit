import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type BiomeConfig = { root?: boolean; files?: { includes?: string[] } };

templateSuite("astro-react-client", {
  pass: [
    {
      name: "base + defaults",
      recipes: [],
      exists: [
        "astro.config.mjs",
        "src/general.d.ts",
        "src/pages/index.astro",
        "src/pages/404.astro",
        "src/pages/en/articles/[slug].astro",
        "src/pages/vi/articles/[slug].astro",
        "src/components/article-page/index.astro",
        "src/lib/articles/load-article.ts",
        "src/lib/articles/types.ts",
        "src/content.config.ts",
        "src/content/landing/about.md",
        "src/content/articles/hello-world.md",
        "src/pages/en/index.astro",
        "src/pages/vi/index.astro",
        "src/pages/en/about.astro",
        "src/i18n/config.ts",
        "src/i18n/translations.ts",
        "src/i18n/locales/en/common.json",
        "src/i18n/locales/vi/common.json",
        "src/components/locale-switcher/index.astro",
        "src/components/site-header/index.astro",
        "src/layouts/base-layout/index.astro",
        "src/layouts/site-layout/index.astro",
        "src/layouts/entry-layout/index.astro",
        "src/layouts/console-layout/index.astro",
        "src/pages/en/auth/login.astro",
        "src/pages/en/console/index.astro",
        "src/components/counter/index.tsx",
        "src/styles/global.css",
        "src/lib/utils/api.ts",
        "src/hooks/use-mobile-view.ts",
        ".agents/skills/astro/SKILL.md",
        ".agents/skills/project-structure/SKILL.md",
      ],
      deps: ["astro", "@astrojs/react", "@astrojs/node", "react", "react-dom"],
      devDeps: ["typescript"],
      scripts: {
        dev: "astro dev",
        build: "astro build",
        check: "astro sync && tsc --noEmit",
        typecheck: "astro sync && tsc --noEmit",
      },
      contains: {
        "astro.config.mjs": [
          "@astrojs/react",
          "@astrojs/node",
          "react()",
          "site:",
          "adapter:",
          "prefixDefaultLocale",
          "defaultLocale",
        ],
        "src/pages/en/articles/[slug].astro": ["prerender = false", "loadArticle", "Astro.rewrite"],
        "src/lib/articles/load-article.ts": [
          "CMS_API_URL",
          'getEntry("articles"',
          'source: "content"',
        ],
        "src/content.config.ts": ["landing", "articles"],
        "src/components/article-page/index.astro": [
          "schema.org",
          'ogType="article"',
          'source === "cms"',
          "set:html",
        ],
        "src/pages/en/about.astro": ['getEntry("landing"', "render"],
        "src/layouts/base-layout/index.astro": [
          'rel="canonical"',
          "og:title",
          "application/ld+json",
        ],
        "src/pages/index.astro": ["Astro.redirect", "defaultLocale"],
        "src/pages/en/index.astro": ["client:load", "Counter"],
        "src/i18n/config.ts": ['"en"', '"vi"'],
        "AGENTS.md": [".agents/skills/astro/SKILL.md"],
      },
      absent: ["src/lib/articles/demo-articles.ts"],
    },
    {
      name: "biome + zustand + hookform-zod + kyjs",
      recipes: ["biome", "zustand", "hookform-zod", "kyjs"],
      exists: [
        "biome.json",
        "src/stores/something.store.ts",
        "src/lib/schemas/example.schema.ts",
        "src/lib/fetcher/index.ts",
      ],
      scripts: { check: "biome check ." },
      check: (app) => {
        const biome = app.json<BiomeConfig>("biome.json");
        assert.equal(biome.root, undefined, "scaffolded biome.json must not set root");
        assert.ok(biome.files?.includes?.includes("!**/*.astro"));
      },
    },
    {
      name: "eslint",
      recipes: ["eslint"],
      exists: ["eslint.config.js"],
      absent: ["biome.json"],
      devDeps: ["eslint", "eslint-plugin-react-hooks", "eslint-plugin-astro"],
      contains: {
        "eslint.config.js": ["eslint-plugin-astro", "react-hooks"],
      },
    },
    {
      name: "shadcn-ui",
      recipes: ["shadcn-ui"],
      exists: [
        "components.json",
        "src/styles/global.css",
        "src/components/ui/button.tsx",
        "src/lib/utils/other.ts",
      ],
      deps: ["shadcn", "@tailwindcss/vite", "tailwindcss"],
      contains: {
        "astro.config.mjs": [
          "@tailwindcss/vite",
          "tailwindcss()",
          "@astrojs/node",
          "site:",
          "prefixDefaultLocale",
          "i18n",
        ],
        "components.json": ["src/styles/global.css"],
        "src/lib/utils/index.ts": ['./other"'],
        "src/styles/global.css": ['@import "tailwindcss"'],
      },
    },
    {
      name: "antd",
      recipes: ["antd"],
      exists: [
        "src/components/antd-theme-provider.tsx",
        "src/components/ui/button.tsx",
        "src/configs/theme.ts",
      ],
      deps: ["antd"],
      contains: {
        "src/components/antd-theme-provider.tsx": ["AntdThemeProvider", "ConfigProvider"],
      },
    },
    {
      name: "mui",
      recipes: ["mui"],
      exists: [
        "src/components/mui-theme-provider.tsx",
        "src/components/ui/button.tsx",
        "src/configs/theme.ts",
      ],
      deps: ["@mui/material"],
      noDeps: ["@mui/material-nextjs"],
    },
    {
      name: "storybook",
      recipes: ["storybook"],
      exists: [".storybook/main.ts", ".storybook/preview.ts"],
      devDeps: ["storybook", "@storybook/react-vite"],
    },
  ],
  reject: [
    { name: "nuxt-ui (vue)", recipes: ["nuxt-ui"], output: [/targets vue/] },
    { name: "pinia (vue)", recipes: ["pinia"], output: [/targets vue/] },
    { name: "type-orm (server)", recipes: ["type-orm"], output: [/scope 'client'/] },
  ],
});
