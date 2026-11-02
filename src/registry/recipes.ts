import { UI_FRAMEWORK_CATEGORIES } from "../constants.js";
import type { RecipeCategory, RecipeConfig, Scope, UiFrameworkCategory } from "../types.js";

export function getRecipeCategories(recipe: RecipeConfig): RecipeCategory[] {
  return Array.isArray(recipe.category) ? [...recipe.category] : [recipe.category];
}

export function recipeHasCategory(recipe: RecipeConfig, category: RecipeCategory): boolean {
  return getRecipeCategories(recipe).includes(category);
}

export const recipes: Record<string, RecipeConfig> = {
  eslint: {
    id: "eslint",
    name: "ESLint",
    category: "linter",
    supportedScopes: ["client", "server", "hybrid"],
    exclusive: true,
    packages: {},
    devDependencies: {
      eslint: "^10.14.0",
      "@eslint/js": "^10.0.1",
      "typescript-eslint": "^8.72.1",
      globals: "^17.14.0",
    },
    overlayDevDependencies: {
      "vite-react": {
        "eslint-plugin-react-hooks": "^7.1.1",
        "eslint-plugin-react-refresh": "^0.5.7",
      },
      next: {
        "eslint-plugin-react-hooks": "^7.1.1",
        "eslint-plugin-react-refresh": "^0.5.7",
      },
    },
    scripts: {
      lint: "eslint .",
      "lint:fix": "eslint . --fix",
    },
  },
  biome: {
    id: "biome",
    name: "Biome",
    category: "linter",
    supportedScopes: ["client", "server", "hybrid"],
    exclusive: true,
    packages: {},
    devDependencies: {
      "@biomejs/biome": "^2.6.4",
    },
    scripts: {
      check: "biome check .",
      "check:write": "biome check --write .",
      format: "biome format --write .",
    },
  },
  zustand: {
    id: "zustand",
    name: "Zustand",
    category: "state",
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      zustand: "^5.0.16",
    },
    devDependencies: {},
    scripts: {},
  },
  nanostores: {
    id: "nanostores",
    name: "Nanostores",
    category: "state",
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      nanostores: "^1.5.5",
      "@nanostores/react": "^2.0.1",
    },
    devDependencies: {},
    scripts: {},
  },
  "client-shared-pieces": {
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
    },
  },
  "hookform-zod": {
    id: "hookform-zod",
    name: "React Hook Form + Zod",
    category: "form",
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      "react-hook-form": "^7.91.0",
      "@hookform/resolvers": "^7.0.1",
      zod: "^4.6.7",
    },
    devDependencies: {},
    scripts: {},
  },
  kyjs: {
    id: "kyjs",
    name: "Ky",
    category: "fetcher",
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      ky: "^2.2.0",
    },
    devDependencies: {},
    scripts: {},
  },
  axios: {
    id: "axios",
    name: "Axios",
    category: "fetcher",
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      axios: "^1.21.0",
    },
    devDependencies: {},
    scripts: {},
  },
  antd: {
    id: "antd",
    name: "Ant Design",
    category: ["ui", "ui-react"],
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      antd: "^6.6.8",
    },
    overlayPackages: {
      next: {
        "@ant-design/nextjs-registry": "^1.3.0",
      },
    },
    devDependencies: {},
    scripts: {},
    fileTransforms: {
      "vite-react": [
        {
          file: "src/main.tsx",
          pattern: /import App from "\.\/app";/,
          replacement:
            'import App from "./app";\nimport { AntdThemeProvider } from "./app/antd-theme-provider";',
        },
        {
          file: "src/main.tsx",
          pattern: /<App \/>/g,
          replacement: "<AntdThemeProvider><App /></AntdThemeProvider>",
        },
      ],
      next: [
        {
          file: "src/app/layout.tsx",
          pattern: /import "\.\/globals\.css";/,
          replacement:
            'import { AntdRegistry } from "@ant-design/nextjs-registry";\nimport "./globals.css";',
        },
        {
          file: "src/app/layout.tsx",
          pattern: /<body>\{children\}<\/body>/,
          replacement: "<body><AntdRegistry>{children}</AntdRegistry></body>",
        },
        {
          file: "src/app/[locale]/layout.tsx",
          pattern: /import \{ hasLocale, NextIntlClientProvider \} from "next-intl";/,
          replacement:
            'import { hasLocale, NextIntlClientProvider } from "next-intl";\nimport { AntdThemeProvider } from "@/app/antd-theme-provider";',
        },
        {
          file: "src/app/[locale]/layout.tsx",
          pattern: /return <NextIntlClientProvider>\{children\}<\/NextIntlClientProvider>;/,
          replacement:
            "return (\n    <NextIntlClientProvider>\n      <AntdThemeProvider>{children}</AntdThemeProvider>\n    </NextIntlClientProvider>\n  );",
        },
      ],
    },
  },
  mui: {
    id: "mui",
    name: "MUI",
    category: ["ui", "ui-react"],
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      "@mui/material": "^9.5.0",
      "@emotion/react": "^11.14.0",
      "@emotion/styled": "^11.14.1",
    },
    overlayPackages: {
      next: {
        "@mui/material-nextjs": "^9.5.0",
        "@emotion/cache": "^11.14.0",
        "@emotion/server": "^11.11.0",
      },
    },
    devDependencies: {},
    scripts: {},
    fileTransforms: {
      "vite-react": [
        {
          file: "src/main.tsx",
          pattern: /import App from "\.\/app";/,
          replacement:
            'import App from "./app";\nimport { MuiThemeProvider } from "./app/mui-theme-provider";',
        },
        {
          file: "src/main.tsx",
          pattern: /<App \/>/g,
          replacement: "<MuiThemeProvider><App /></MuiThemeProvider>",
        },
      ],
      next: [
        {
          file: "src/app/layout.tsx",
          pattern: /import "\.\/globals\.css";/,
          replacement:
            'import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";\nimport "./globals.css";',
        },
        {
          file: "src/app/layout.tsx",
          pattern: /<body>\{children\}<\/body>/,
          replacement: "<body><AppRouterCacheProvider>{children}</AppRouterCacheProvider></body>",
        },
        {
          file: "src/app/[locale]/layout.tsx",
          pattern: /import \{ hasLocale, NextIntlClientProvider \} from "next-intl";/,
          replacement:
            'import { hasLocale, NextIntlClientProvider } from "next-intl";\nimport { MuiThemeProvider } from "@/app/mui-theme-provider";',
        },
        {
          file: "src/app/[locale]/layout.tsx",
          pattern: /return <NextIntlClientProvider>\{children\}<\/NextIntlClientProvider>;/,
          replacement:
            "return (\n    <NextIntlClientProvider>\n      <MuiThemeProvider>{children}</MuiThemeProvider>\n    </NextIntlClientProvider>\n  );",
        },
      ],
    },
  },
  "shadcn-ui": {
    id: "shadcn-ui",
    name: "shadcn/ui (core: base-ui | theme: vega | icons: lucide)",
    category: ["ui", "ui-react"],
    supportedScopes: ["client", "hybrid"],
    exclusive: true,
    packages: {
      shadcn: "^4.23.0",
      "@base-ui/react": "^1.9.0",
      "@fontsource-variable/inter": "^5.3.0",
      cn: "^0.5.2",
      "class-variance-authority": "^0.7.1",
      "lucide-react": "^1.66.0",
      tailwindcss: "^4.3.3",
      "tw-animate-css": "^1.4.0",
    },
    overlayPackages: {
      "vite-react": {
        "@tailwindcss/vite": "^4.3.3",
      },
      next: {
        "@tailwindcss/postcss": "^4.3.3",
      },
    },
    devDependencies: {},
    scripts: {},
    fileTransforms: {
      "vite-react": [
        {
          file: "src/lib/utils/index.ts",
          append: 'export * from "./other";',
        },
      ],
    },
  },
  storybook: {
    id: "storybook",
    name: "Storybook",
    category: ["ui", "testing", "documentation"],
    supportedScopes: ["client", "hybrid"],
    exclusive: false,
    packages: {},
    overlayDevDependencies: {
      "vite-react": {
        storybook: "^10.6.5",
        "@storybook/react-vite": "^10.6.5",
      },
      next: {
        storybook: "^10.6.5",
        "@storybook/nextjs": "^10.6.5",
      },
    },
    devDependencies: {},
    scripts: {
      storybook: "storybook dev -p 6006",
      "build-storybook": "storybook build",
    },
  },
  "type-orm": {
    id: "type-orm",
    name: "TypeORM",
    category: "orm",
    supportedScopes: ["server"],
    exclusive: true,
    packages: {
      typeorm: "^1.1.2",
    },
    overlayPackages: {
      nest: {
        "@nestjs/typeorm": "^12.0.2",
      },
    },
    devDependencies: {},
    scripts: {},
    fileTransforms: {
      nest: [
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /import \{ Module \} from "@nestjs\/common";/,
          replacement:
            'import { Module } from "@nestjs/common";\n// Uncomment after configuring a DB driver + env — see .agents/skills/type-orm/SKILL.md\n// import { TypeormPersistenceModule } from "@/infrastructure/persistence/typeorm/typeorm.module.js";',
        },
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /imports: \[FeatureAModule, FeatureBModule\],/,
          replacement:
            "imports: [\n    // TypeormPersistenceModule,\n    FeatureAModule,\n    FeatureBModule,\n  ],",
        },
      ],
      hono: [
        {
          file: "src/bootstrap/container.ts",
          pattern: /import \{ createFeatureA \} from "\.\/modules\/feature-a\.js";/,
          replacement:
            '// Uncomment after configuring a DB driver + env — see .agents/skills/type-orm/SKILL.md\n// import { createTypeOrmDataSource } from "@/infrastructure/persistence/typeorm/typeorm.data-source.js";\nimport { createFeatureA } from "./modules/feature-a.js";',
        },
        {
          file: "src/bootstrap/container.ts",
          pattern: /export function createContainer\(\): AppContainer \{\n {2}return \{/,
          replacement:
            "export function createContainer(): AppContainer {\n  // void createTypeOrmDataSource; // wire into adapters after configuring a driver\n  return {",
        },
        {
          file: "tsconfig.json",
          pattern: /"isolatedModules": true,/,
          replacement:
            '"isolatedModules": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true,',
        },
      ],
    },
  },
  "mikro-orm": {
    id: "mikro-orm",
    name: "MikroORM",
    category: "orm",
    supportedScopes: ["server"],
    exclusive: true,
    packages: {
      "@mikro-orm/core": "^7.2.6",
      "@mikro-orm/decorators": "^7.2.6",
    },
    overlayPackages: {
      nest: {
        "@mikro-orm/nestjs": "^7.1.0",
      },
    },
    devDependencies: {},
    scripts: {},
    fileTransforms: {
      nest: [
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /import \{ Module \} from "@nestjs\/common";/,
          replacement:
            'import { Module } from "@nestjs/common";\n// Uncomment after configuring a DB driver + env — see .agents/skills/mikro-orm/SKILL.md\n// import { MikroOrmPersistenceModule } from "@/infrastructure/persistence/mikro-orm/mikro-orm.module.js";',
        },
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /imports: \[FeatureAModule, FeatureBModule\],/,
          replacement:
            "imports: [\n    // MikroOrmPersistenceModule,\n    FeatureAModule,\n    FeatureBModule,\n  ],",
        },
      ],
      hono: [
        {
          file: "src/bootstrap/container.ts",
          pattern: /import \{ createFeatureA \} from "\.\/modules\/feature-a\.js";/,
          replacement:
            '// Uncomment after configuring a DB driver + env — see .agents/skills/mikro-orm/SKILL.md\n// import { createMikroOrm } from "@/infrastructure/persistence/mikro-orm/mikro-orm.bootstrap.js";\nimport { createFeatureA } from "./modules/feature-a.js";',
        },
        {
          file: "src/bootstrap/container.ts",
          pattern: /export function createContainer\(\): AppContainer \{\n {2}return \{/,
          replacement:
            "export function createContainer(): AppContainer {\n  // await createMikroOrm(); // wire into adapters after configuring a driver\n  return {",
        },
        {
          file: "tsconfig.json",
          pattern: /"isolatedModules": true,/,
          replacement:
            '"isolatedModules": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true,',
        },
      ],
    },
  },
  "drizzle-orm": {
    id: "drizzle-orm",
    name: "Drizzle ORM",
    category: "orm",
    supportedScopes: ["server"],
    exclusive: true,
    packages: {
      "drizzle-orm": "^0.45.4",
    },
    devDependencies: {
      "drizzle-kit": "^0.31.11",
    },
    scripts: {
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
      "db:studio": "drizzle-kit studio",
    },
    fileTransforms: {
      nest: [
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /import \{ Module \} from "@nestjs\/common";/,
          replacement:
            'import { Module } from "@nestjs/common";\n// Uncomment after configuring a DB driver + env — see .agents/skills/drizzle-orm/SKILL.md\n// import { DrizzlePersistenceModule } from "@/infrastructure/persistence/drizzle/drizzle.module.js";',
        },
        {
          file: "src/bootstrap/app.module.ts",
          pattern: /imports: \[FeatureAModule, FeatureBModule\],/,
          replacement:
            "imports: [\n    // DrizzlePersistenceModule,\n    FeatureAModule,\n    FeatureBModule,\n  ],",
        },
      ],
      hono: [
        {
          file: "src/bootstrap/container.ts",
          pattern: /import \{ createFeatureA \} from "\.\/modules\/feature-a\.js";/,
          replacement:
            '// Uncomment after configuring a DB driver + env — see .agents/skills/drizzle-orm/SKILL.md\n// import { createDrizzleClient } from "@/infrastructure/persistence/drizzle/drizzle.bootstrap.js";\nimport { createFeatureA } from "./modules/feature-a.js";',
        },
        {
          file: "src/bootstrap/container.ts",
          pattern: /export function createContainer\(\): AppContainer \{\n {2}return \{/,
          replacement:
            "export function createContainer(): AppContainer {\n  // createDrizzleClient(); // wire into adapters after configuring a driver\n  return {",
        },
      ],
    },
  },
};

export function getRecipe(id: string): RecipeConfig | undefined {
  return recipes[id];
}

export function getAllRecipeIds(): string[] {
  return Object.keys(recipes);
}

export function getRecipesByCategory(category: RecipeCategory): RecipeConfig[] {
  return Object.values(recipes).filter((recipe) => recipeHasCategory(recipe, category));
}

/**
 * Exclusive UI kits for a UI framework family.
 * - Shared kits tagged only `ui` (no ui-react/ui-vue/ui-svelte) are always included.
 * - Framework-specific kits must include that family tag (e.g. `ui-react`).
 */
export function getExclusiveUiRecipes(family: UiFrameworkCategory): RecipeConfig[] {
  return getRecipesByCategory("ui").filter((recipe) => {
    if (!recipe.exclusive) {
      return false;
    }

    const cats = getRecipeCategories(recipe);
    const frameworkTags = cats.filter((category): category is UiFrameworkCategory =>
      (UI_FRAMEWORK_CATEGORIES as readonly string[]).includes(category),
    );

    if (frameworkTags.length === 0) {
      return true;
    }

    return frameworkTags.includes(family);
  });
}

export function isDefaultRecipeSupportedForScope(recipe: RecipeConfig, scope: Scope): boolean {
  if (!recipe.default) {
    return false;
  }

  if (recipe.supportedScopes === "all") {
    return true;
  }

  if (scope === "hybrid") {
    return (
      recipe.supportedScopes.includes("client") ||
      recipe.supportedScopes.includes("server") ||
      recipe.supportedScopes.includes("hybrid")
    );
  }

  return recipe.supportedScopes.includes(scope);
}

export function withDefaultRecipes(scope: Scope, recipeIds: string[]): string[] {
  const defaults = Object.values(recipes)
    .filter((recipe) => isDefaultRecipeSupportedForScope(recipe, scope))
    .map((recipe) => recipe.id);

  const merged = [...defaults];

  for (const id of recipeIds) {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  }

  return merged;
}
