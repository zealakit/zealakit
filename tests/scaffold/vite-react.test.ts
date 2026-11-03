import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type BiomeConfig = { root?: boolean; linter?: { domains?: Record<string, string> } };

templateSuite("vite-react", {
  pass: [
    {
      name: "biome + zustand + hookform-zod + kyjs",
      recipes: ["biome", "zustand", "hookform-zod", "kyjs"],
      exists: [
        "src/lib/utils/api.ts",
        "src/lib/utils/index.ts",
        "src/lib/constants/index.ts",
        "src/hooks/use-mobile-view.ts",
        "src/layouts/console-layout/index.ts",
        "src/configs/i18n.ts",
        "src/lib/schemas/example.schema.ts",
        "src/lib/fetcher/index.ts",
        "src/stores/something.store.ts",
        "biome.json",
        ".agents/skills/hookform-zod/SKILL.md",
        ".agents/rules/hookform-zod.mdc",
        ".cursor/skills/hookform-zod/SKILL.md",
      ],
      absent: [
        ".agents/skills/project-structure/forms.md",
        "src/stores/something.store.test.ts",
        "vitest.config.ts",
        "eslint.config.js",
      ],
      noDeps: ["axios", "antd", "@mui/material", "shadcn"],
      noDevDeps: ["vitest"],
      scripts: { check: "biome check ." },
      noScripts: ["test", "lint"],
      contains: {
        "src/main.tsx": ['import "./configs/i18n";'],
        "AGENTS.md": [".agents/skills/hookform-zod/SKILL.md"],
        "CLAUDE.md": [".agents/skills/hookform-zod/SKILL.md"],
      },
      check: (app) => {
        const biome = app.json<BiomeConfig>("biome.json");
        assert.equal(biome.root, undefined, "scaffolded biome.json must not set root");
        assert.equal(biome.linter?.domains?.next, undefined, "no next domain on vite-react");
      },
    },
    {
      name: "eslint only",
      recipes: ["eslint"],
      exists: ["eslint.config.js", "src/lib/utils/api.ts"],
      absent: ["biome.json", "src/lib/fetcher/index.ts", ".agents/skills/hookform-zod/SKILL.md"],
      devDeps: ["eslint", "eslint-plugin-react-hooks"],
      excludes: { "AGENTS.md": [".agents/skills/hookform-zod/SKILL.md"] },
    },
    {
      name: "axios",
      recipes: ["axios"],
      exists: ["src/lib/fetcher/index.ts"],
      noDeps: ["ky"],
    },
    {
      name: "antd",
      recipes: ["antd"],
      exists: [
        "src/app/antd-theme-provider.tsx",
        "src/components/ui/index.ts",
        "src/components/ui/button.tsx",
        "src/configs/theme.ts",
        ".agents/skills/antd/SKILL.md",
      ],
      contains: {
        "src/main.tsx": [
          'import { AntdThemeProvider } from "./app/antd-theme-provider"',
          "<AntdThemeProvider><App /></AntdThemeProvider>",
        ],
        "AGENTS.md": [".agents/skills/antd/SKILL.md"],
      },
      excludes: { "src/app/index.tsx": ["AntdThemeProvider"] },
    },
    {
      name: "mui",
      recipes: ["mui"],
      exists: [
        "src/app/mui-theme-provider.tsx",
        "src/components/ui/index.ts",
        "src/components/ui/button.tsx",
        "src/configs/theme.ts",
        ".agents/skills/mui/SKILL.md",
        ".agents/skills/material-ui-nextjs/SKILL.md",
        ".agents/skills/material-ui-theming/SKILL.md",
        ".agents/skills/material-ui-styling/SKILL.md",
      ],
      contains: {
        "src/main.tsx": [
          'import { MuiThemeProvider } from "./app/mui-theme-provider"',
          "<MuiThemeProvider><App /></MuiThemeProvider>",
        ],
        "AGENTS.md": [".agents/skills/mui/SKILL.md", ".agents/skills/material-ui-nextjs/SKILL.md"],
      },
      excludes: { "src/app/index.tsx": ["MuiThemeProvider"] },
    },
    {
      name: "shadcn-ui",
      recipes: ["shadcn-ui"],
      exists: [
        "src/components/ui/index.ts",
        "src/components/ui/button.tsx",
        "src/styles/globals.css",
        "components.json",
        "src/lib/utils/other.ts",
        ".agents/skills/shadcn-ui/SKILL.md",
      ],
      noDeps: ["radix-ui", "next-themes"],
      contains: {
        "src/lib/utils/index.ts": ['export * from "./api"', 'export * from "./other"'],
        "vite.config.ts": ["@tailwindcss/vite"],
        "components.json": ['"style": "base-vega"', "src/styles/globals.css"],
        "AGENTS.md": [".agents/skills/shadcn-ui/SKILL.md"],
      },
      excludes: { "src/main.tsx": ["ShadcnThemeProvider"] },
    },
    {
      name: "mui + storybook coexist",
      recipes: ["mui", "storybook"],
      exists: [".storybook/main.ts", ".agents/skills/storybook/SKILL.md"],
      deps: ["@mui/material"],
      devDeps: ["storybook", "@storybook/react-vite"],
      contains: { "AGENTS.md": [".agents/skills/storybook/SKILL.md"] },
    },
  ],
  reject: [
    { name: "biome + eslint", recipes: ["biome", "eslint"], output: [/conflict/i, /linter/i] },
    {
      name: "zustand + nanostores",
      recipes: ["zustand", "nanostores"],
      output: [/conflict/i, /state/i],
    },
    { name: "kyjs + axios", recipes: ["kyjs", "axios"], output: [/conflict/i, /fetcher/i] },
    { name: "pinia (vue)", recipes: ["pinia"], output: [/targets vue/, /Try: zustand/] },
    { name: "vee-validate-zod (vue)", recipes: ["vee-validate-zod"], output: [/hookform-zod/] },
    { name: "nuxt-ui (vue)", recipes: ["nuxt-ui"] },
    { name: "drizzle-orm (server)", recipes: ["drizzle-orm"], output: [/scope 'client'/] },
  ],
});
