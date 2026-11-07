import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

templateSuite("next", {
  pass: [
    {
      name: "shadcn-ui",
      recipes: ["shadcn-ui"],
      exists: [
        "src/components/ui/button.tsx",
        "src/app/globals.css",
        "components.json",
        "postcss.config.mjs",
        "src/lib/utils/index.ts",
        "src/general.d.ts",
      ],
      deps: ["shadcn", "@tailwindcss/postcss"],
      noDeps: ["@tailwindcss/vite"],
      contains: { "components.json": ['"rsc": true', "src/app/globals.css"] },
    },
    {
      name: "antd",
      recipes: ["antd"],
      exists: [
        "src/app/antd-theme-provider.tsx",
        "src/configs/theme.ts",
        "src/components/ui/button.tsx",
      ],
      deps: ["antd", "@ant-design/nextjs-registry"],
      contains: {
        "src/app/antd-theme-provider.tsx": ['"use client"'],
        "src/app/layout.tsx": [
          "@ant-design/nextjs-registry",
          "<AntdRegistry>{children}</AntdRegistry>",
        ],
        "src/app/[locale]/layout.tsx": [
          'from "@/app/antd-theme-provider"',
          "<AntdThemeProvider>{children}</AntdThemeProvider>",
          "NextIntlClientProvider",
        ],
      },
      excludes: {
        "src/app/antd-theme-provider.tsx": ["@ant-design/nextjs-registry"],
        "src/app/layout.tsx": ["AntdThemeProvider"],
      },
    },
    {
      name: "mui",
      recipes: ["mui"],
      exists: [
        "src/app/mui-theme-provider.tsx",
        "src/configs/theme.ts",
        "src/components/ui/button.tsx",
        ".agents/skills/material-ui-nextjs/SKILL.md",
        ".agents/skills/material-ui-theming/AGENTS.md",
      ],
      deps: ["@mui/material", "@mui/material-nextjs", "@emotion/cache"],
      contains: {
        "src/app/mui-theme-provider.tsx": ['"use client"'],
        "src/app/layout.tsx": [
          "@mui/material-nextjs/v16-appRouter",
          "<AppRouterCacheProvider>{children}</AppRouterCacheProvider>",
        ],
        "src/app/[locale]/layout.tsx": [
          'from "@/app/mui-theme-provider"',
          "<MuiThemeProvider>{children}</MuiThemeProvider>",
          "NextIntlClientProvider",
        ],
      },
      excludes: {
        "src/app/mui-theme-provider.tsx": ["@mui/material-nextjs"],
        "src/app/layout.tsx": ["MuiThemeProvider"],
      },
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
  ],
  reject: [{ name: "nuxt-ui (vue)", recipes: ["nuxt-ui"], output: [/targets vue/] }],
});
