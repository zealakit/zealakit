import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type BiomeConfig = { root?: boolean; files?: { includes?: string[] } };

templateSuite("astro-react-hybrid", {
  pass: [
    {
      name: "base + defaults",
      recipes: [],
      exists: [
        "astro.config.mjs",
        "src/middleware.ts",
        "src/actions/index.ts",
        "src/pages/api/health.ts",
        "src/components/user-profile-island/index.astro",
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
        "src/layouts/base-layout/index.astro",
        "src/layouts/site-layout/index.astro",
        ".agents/skills/astro/SKILL.md",
      ],
      deps: ["astro", "@astrojs/react", "@astrojs/node", "react", "react-dom"],
      scripts: { dev: "astro dev", build: "astro build" },
      contains: {
        "astro.config.mjs": [
          "@astrojs/node",
          'output: "server"',
          "sessionDrivers",
          "session:",
          "adapter:",
          "site:",
          "prefixDefaultLocale",
        ],
        "src/middleware.ts": ["defineMiddleware", "requestId", "session"],
        "src/actions/index.ts": ["defineAction", "setDisplayName"],
        "src/pages/api/health.ts": ["prerender = false", "APIRoute"],
        "src/pages/en/index.astro": ["server:defer", "UserProfileIsland", "actions.setDisplayName"],
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
        "src/env.d.ts": ["SessionData", "Locals", "requestId", "CMS_API_URL"],
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
          "sessionDrivers",
          "site:",
          "prefixDefaultLocale",
        ],
        "src/lib/utils/index.ts": ['./other"'],
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
    {
      name: "prisma (hybrid ORM)",
      recipes: ["prisma"],
      exists: [
        "src/lib/persistence/prisma/prisma.bootstrap.ts",
        "src/lib/persistence/prisma/prisma.client.ts",
        "prisma/schema.prisma",
        "prisma.config.ts",
      ],
      absent: ["src/lib/persistence/prisma/prisma.module.ts", "src/infrastructure"],
      deps: ["@prisma/client"],
      devDeps: ["prisma"],
      contains: {
        "AGENTS.md": [".agents/skills/prisma/SKILL.md"],
        "prisma.config.ts": ["DATABASE_URL"],
      },
      check(app) {
        assert.doesNotMatch(app.read("prisma/schema.prisma"), /^\s*url\s*=/m);
      },
    },
    {
      name: "drizzle-orm (hybrid ORM)",
      recipes: ["drizzle-orm"],
      exists: ["src/lib/persistence/drizzle/drizzle.bootstrap.ts", "drizzle.config.ts"],
      deps: ["drizzle-orm"],
      devDeps: ["drizzle-kit"],
    },
  ],
  reject: [
    { name: "nuxt-ui (vue)", recipes: ["nuxt-ui"], output: [/targets vue/] },
    { name: "pinia (vue)", recipes: ["pinia"], output: [/targets vue/] },
  ],
});
