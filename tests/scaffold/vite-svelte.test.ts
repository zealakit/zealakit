import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type TsConfig = {
  extends?: string;
  compilerOptions?: {
    strict?: boolean;
    moduleResolution?: string;
    noEmit?: boolean;
    paths?: Record<string, string[]>;
    types?: string[];
  };
  include?: string[];
};

templateSuite("vite-svelte", {
  pass: [
    {
      name: "biome + nanostores + kyjs + storybook",
      recipes: ["biome", "nanostores", "kyjs", "storybook"],
      exists: [
        "src/app.html",
        "src/app.d.ts",
        "src/vite-env.d.ts",
        "vite.config.ts",
        "svelte.config.js",
        "tsconfig.json",
        "src/routes/+layout.svelte",
        "src/routes/+layout.ts",
        "src/routes/(app)/+layout.svelte",
        "src/routes/(app)/+page.svelte",
        "src/routes/(app)/feature-a/+page.svelte",
        "src/routes/(app)/feature-a/[id]/+page.svelte",
        "src/routes/(auth)/+layout.svelte",
        "src/routes/(auth)/login/+page.svelte",
        "src/routes/(auth)/sign-up/+page.svelte",
        "src/routes/(auth)/forgot-password/+page.svelte",
        "src/features/overview/overview.svelte",
        "src/features/auth/login.svelte",
        "src/features/feature-a/list.svelte",
        "src/features/feature-a/detail.svelte",
        "src/features/feature-a/composables/use-feature-a-filter.svelte.ts",
        "src/layouts/console-layout/index.svelte",
        "src/layouts/entry-layout/index.svelte",
        "src/components/feature-shell/index.svelte",
        "src/configs/routes.ts",
        "src/configs/env.ts",
        "src/configs/i18n.svelte.ts",
        "src/assets/locales/en/common.json",
        "src/assets/locales/en/action.json",
        "src/assets/locales/en/field.json",
        "src/assets/locales/en/message.json",
        "src/assets/locales/vi/common.json",
        "src/assets/locales/vi/action.json",
        "src/assets/locales/vi/field.json",
        "src/assets/locales/vi/message.json",
        "src/stores/session.svelte.ts",
        "src/composables/use-document-title.svelte.ts",
        "src/styles/globals.css",
        "static/vite.svg",
        "biome.json",
        "src/stores/something.store.ts",
        "src/lib/fetcher/index.ts",
        "src/lib/utils/api.ts",
        ".storybook/main.ts",
        ".agents/skills/svelte/SKILL.md",
        ".agents/rules/svelte.mdc",
        ".cursor/skills/svelte/SKILL.md",
      ],
      absent: [
        "index.html",
        "src/main.ts",
        "src/app.svelte",
        "src/general.d.ts",
        "tsconfig.app.json",
        "tsconfig.node.json",
        "public",
        ".svelte-kit",
        "build",
        ".eslintrc.cjs",
      ],
      deps: ["i18next", "i18next-browser-languagedetector", "nanostores", "ky"],
      noDeps: ["react", "vue", "@sveltejs/kit"],
      devDeps: [
        "svelte",
        "@sveltejs/kit",
        "@sveltejs/adapter-static",
        "@sveltejs/vite-plugin-svelte",
        "svelte-check",
        "storybook",
        "@storybook/sveltekit",
      ],
      noDevDeps: [
        "@vitejs/plugin-react",
        "@vitejs/plugin-vue",
        "vue-tsc",
        "@sveltejs/adapter-auto",
      ],
      scripts: {
        dev: "vite dev",
        build: "vite build",
        preview: "vite preview",
        // Biome owns the `check` script when applied; `check:svelte` stays available.
        check: "biome check .",
        "check:svelte": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
      },
      contains: {
        "src/app.html": ["%sveltekit.head%", "%sveltekit.body%", "%sveltekit.assets%/vite.svg"],
        "src/routes/+layout.svelte": [
          "@/configs/i18n.svelte",
          "styles/globals.css",
          "{@render children()}",
        ],
        "src/routes/(app)/+page.svelte": ["@/features/overview/overview.svelte"],
        "src/routes/(app)/feature-a/+page.svelte": ["@/features/feature-a/list.svelte"],
        "src/routes/(app)/feature-a/[id]/+page.svelte": [
          "$app/state",
          "page.params.id",
          "@/features/feature-a/detail.svelte",
        ],
        "src/features/feature-a/list.svelte": ["$derived", "useFeatureAFilter", "ROUTES"],
        "src/features/auth/login.svelte": ["$state", "signIn", "$app/navigation", "goto"],
        "src/features/overview/overview.svelte": [
          "translate",
          "setLocale",
          "locale.current",
          "<select",
          'translate("APP.TITLE")',
        ],
        "src/configs/i18n.svelte.ts": [
          "fallbackLng",
          "supportedLngs",
          "changeLanguage",
          "$state",
          "initAsync: false",
          "fallbackLng",
          "defaultNS",
          "DEFAULT_LOCALE",
        ],
        "src/stores/session.svelte.ts": ["$state", "signIn", "signOut"],
        "src/components/feature-shell/index.svelte": ["$props()", "{@render children()}"],
        "src/configs/routes.ts": ['overview: "/"', "featureADetail"],
        "svelte.config.js": [
          "@sveltejs/adapter-static",
          'fallback: "index.html"',
          "vitePreprocess()",
          "alias",
        ],
        "vite.config.ts": ["@sveltejs/kit/vite", "sveltekit()"],
        ".storybook/main.ts": ["@storybook/sveltekit", "svelte"],
        "AGENTS.md": [".agents/skills/svelte/SKILL.md"],
        "CLAUDE.md": [".agents/skills/svelte/SKILL.md"],
      },
      excludes: {
        "src/features/feature-a/list.svelte": ["on:click", "<slot"],
        "src/layouts/console-layout/index.svelte": ["<slot"],
      },
      check: (app) => {
        const tsconfig = app.json<TsConfig>("tsconfig.json");
        assert.equal(tsconfig.extends, undefined);
        assert.equal(tsconfig.compilerOptions?.strict, true);
        assert.equal(tsconfig.compilerOptions?.moduleResolution, "bundler");
        assert.equal(tsconfig.compilerOptions?.noEmit, true);
        assert.deepEqual(tsconfig.compilerOptions?.paths, {
          "@/*": ["./src/*"],
          $lib: ["./src/lib"],
          "$lib/*": ["./src/lib/*"],
        });
        assert.ok(tsconfig.compilerOptions?.types?.includes("@sveltejs/kit"));
        assert.ok(tsconfig.include?.includes("src/**/*.svelte"));
        assert.ok(tsconfig.include?.includes(".svelte-kit/**/*.d.ts"));

        const pkg = app.pkg();
        assert.ok(
          pkg.dependencies && !("svelte" in pkg.dependencies),
          "svelte belongs in devDependencies",
        );
        assert.ok(pkg.devDependencies?.["@sveltejs/kit"], "SvelteKit expected");
        assert.ok(pkg.devDependencies?.["@sveltejs/adapter-static"], "static adapter expected");
      },
    },
    {
      name: "eslint",
      recipes: ["eslint"],
      exists: ["eslint.config.js", "src/lib/utils/api.ts", "src/routes/+layout.svelte"],
      absent: ["biome.json"],
      devDeps: ["eslint", "eslint-plugin-svelte", "svelte-eslint-parser"],
      noDevDeps: ["eslint-plugin-react-hooks", "eslint-plugin-vue"],
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix",
        check: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
        "check:svelte": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
      },
      contains: {
        "eslint.config.js": ["eslint-plugin-svelte", "svelte.configs.recommended", '".svelte"'],
      },
    },
  ],
  reject: [
    { name: "mui (react)", recipes: ["mui"], output: [/targets react/] },
    { name: "pinia (vue)", recipes: ["pinia"], output: [/targets vue/] },
    { name: "hookform-zod (react)", recipes: ["hookform-zod"], output: [/targets react/] },
    { name: "shadcn-vue (vue)", recipes: ["shadcn-vue"], output: [/targets vue/] },
  ],
});
