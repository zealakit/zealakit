import type { RecipeConfig, RecipeFileTransform } from "@zealakit/core";

const TS_RECIPE_PREFIX = "typescript/";

/** Identity helper for typed recipe modules (monitor locates the object after `defineRecipe(`). */
export function defineRecipe(recipe: RecipeConfig): RecipeConfig {
  return {
    ...recipe,
    path: recipe.path ?? `${TS_RECIPE_PREFIX}${recipe.id}`,
  };
}

export function appendExport(file: string, specifier: string): RecipeFileTransform {
  return { file, append: `export * from "${specifier}";` };
}

/** Wrap `<App />` in `src/main.tsx` with a provider exported from `src/app/<file>`. */
export function viteReactAppProvider(provider: string, file: string): RecipeFileTransform[] {
  return [
    {
      file: "src/main.tsx",
      pattern: /import App from "\.\/app";/,
      replacement: `import App from "./app";\nimport { ${provider} } from "./app/${file}";`,
    },
    {
      file: "src/main.tsx",
      pattern: /<App \/>/g,
      replacement: `<${provider}><App /></${provider}>`,
    },
  ];
}

type NextUiProviders = {
  /** SSR style registry mounted in the root layout `<body>` */
  registry: { name: string; from: string };
  /** Client theme provider mounted inside `NextIntlClientProvider` */
  theme: { name: string; file: string };
};

export function nextUiProviders({ registry, theme }: NextUiProviders): RecipeFileTransform[] {
  return [
    {
      file: "src/app/layout.tsx",
      pattern: /import "\.\/globals\.css";/,
      replacement: `import { ${registry.name} } from "${registry.from}";\nimport "./globals.css";`,
    },
    {
      file: "src/app/layout.tsx",
      pattern: /<body>\{children\}<\/body>/,
      replacement: `<body><${registry.name}>{children}</${registry.name}></body>`,
    },
    {
      file: "src/app/[locale]/layout.tsx",
      pattern: /import \{ hasLocale, NextIntlClientProvider \} from "next-intl";/,
      replacement: `import { hasLocale, NextIntlClientProvider } from "next-intl";\nimport { ${theme.name} } from "@/app/${theme.file}";`,
    },
    {
      file: "src/app/[locale]/layout.tsx",
      pattern: /return <NextIntlClientProvider>\{children\}<\/NextIntlClientProvider>;/,
      replacement: `return (\n    <NextIntlClientProvider>\n      <${theme.name}>{children}</${theme.name}>\n    </NextIntlClientProvider>\n  );`,
    },
  ];
}

/** Register a module in `nuxt.config.ts` (template keeps a `// zealakit-modules` marker). */
export function nuxtModule(name: string): RecipeFileTransform {
  return {
    file: "nuxt.config.ts",
    pattern: /\/\/ zealakit-modules/,
    replacement: `// zealakit-modules\n    "${name}",`,
  };
}

/** Insert top-level keys before the closing `});` of `nuxt.config.ts`. */
export function nuxtConfigKeys(block: string): RecipeFileTransform {
  return {
    file: "nuxt.config.ts",
    pattern: /\n\}\);\s*$/,
    replacement: `\n${block}});\n`,
  };
}

export const ENABLE_TS_DECORATORS: RecipeFileTransform = {
  file: "tsconfig.json",
  pattern: /"isolatedModules": true,/,
  replacement:
    '"isolatedModules": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true,',
};

type ServerOrmWiring = {
  /** Skill folder under `.agents/skills/` referenced in the generated comments */
  skill: string;
  nest: { module: string; from: string };
  hono: { factory: string; from: string; call: string };
};

/** Commented-out ORM wiring for the DDD server templates (user enables after picking a driver). */
export function serverOrmWiring({ skill, nest, hono }: ServerOrmWiring): {
  nest: RecipeFileTransform[];
  hono: RecipeFileTransform[];
} {
  const note = `// Uncomment after configuring a DB driver + env — see .agents/skills/${skill}/SKILL.md`;

  return {
    nest: [
      {
        file: "src/bootstrap/app.module.ts",
        pattern: /import \{ Module \} from "@nestjs\/common";/,
        replacement: `import { Module } from "@nestjs/common";\n${note}\n// import { ${nest.module} } from "${nest.from}";`,
      },
      {
        file: "src/bootstrap/app.module.ts",
        pattern: /imports: \[FeatureAModule, FeatureBModule\],/,
        replacement: `imports: [\n    // ${nest.module},\n    FeatureAModule,\n    FeatureBModule,\n  ],`,
      },
    ],
    hono: [
      {
        file: "src/bootstrap/container.ts",
        pattern: /import \{ createFeatureA \} from "\.\/modules\/feature-a\.js";/,
        replacement: `${note}\n// import { ${hono.factory} } from "${hono.from}";\nimport { createFeatureA } from "./modules/feature-a.js";`,
      },
      {
        file: "src/bootstrap/container.ts",
        pattern: /export function createContainer\(\): AppContainer \{\n {2}return \{/,
        replacement: `export function createContainer(): AppContainer {\n  // ${hono.call} // wire into adapters after configuring a driver\n  return {`,
      },
    ],
  };
}
