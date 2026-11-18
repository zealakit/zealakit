import { defineRecipe } from "./define.js";

const VUE_IMPORT = {
  pattern: /import \{ createApp \} from "vue";/,
  replacement:
    'import { createApp } from "vue";\nimport { VueQueryPlugin } from "@tanstack/vue-query";',
};

export default defineRecipe({
  id: "tanstack-query",
  discovery: { capabilities: ["external-api"], projectTypes: ["ui"] },
  name: "TanStack Query",
  hint: "Server-state fetching and caching (works beside Ky/Axios)",
  category: "fetcher",
  supportedScopes: ["client", "hybrid"],
  exclusive: false,
  overlayPackages: {
    "vite-react": { "@tanstack/react-query": "^5.108.0" },
    next: { "@tanstack/react-query": "^5.108.0" },
    "vite-vue": { "@tanstack/vue-query": "^5.108.0" },
    nuxt: { "@tanstack/vue-query": "^5.108.0" },
    "vite-svelte": { "@tanstack/svelte-query": "^6.4.3" },
  },
  fileTransforms: {
    "vite-react": [
      {
        file: "src/main.tsx",
        pattern: /import App from "\.\/app";/,
        replacement:
          'import App from "./app";\nimport { QueryProvider } from "./app/query-provider";',
      },
      {
        file: "src/main.tsx",
        pattern: /<App \/>/g,
        replacement: "<QueryProvider><App /></QueryProvider>",
      },
    ],
    next: [
      {
        file: "src/app/layout.tsx",
        pattern: /import "\.\/globals\.css";/,
        replacement:
          'import { QueryProvider } from "@/app/query-provider";\nimport "./globals.css";',
      },
      {
        file: "src/app/layout.tsx",
        pattern: /\{children\}/,
        replacement: "<QueryProvider>{children}</QueryProvider>",
      },
    ],
    "vite-vue": [
      { file: "src/main.ts", ...VUE_IMPORT },
      {
        file: "src/main.ts",
        pattern: /app\.use\(router\)\.mount\(rootElement\);/,
        replacement: "app.use(VueQueryPlugin);\napp.use(router).mount(rootElement);",
      },
    ],
    "vite-svelte": [
      {
        file: "src/routes/+layout.svelte",
        pattern: /let \{ children \} = \$props\(\);/,
        replacement:
          'import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";\n\n  const queryClient = new QueryClient({\n    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },\n  });\n  let { children } = $props();',
      },
      {
        file: "src/routes/+layout.svelte",
        pattern: /\{@render children\(\)\}/,
        replacement:
          "<QueryClientProvider client={queryClient}>\n  {@render children()}\n</QueryClientProvider>",
      },
    ],
  },
});
