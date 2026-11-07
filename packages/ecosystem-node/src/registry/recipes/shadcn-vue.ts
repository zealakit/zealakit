import { appendExport, defineRecipe, nuxtConfigKeys, nuxtModule } from "./define.js";

export default defineRecipe({
  id: "shadcn-vue",
  name: "shadcn-vue (style: new-york | icons: lucide)",
  category: "ui",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["vue"],
  exclusive: true,
  packages: {
    "reka-ui": "^2.11.0",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "tailwind-merge": "^3.7.0",
    "@lucide/vue": "^1.67.0",
    tailwindcss: "^4.3.3",
    "tw-animate-css": "^1.4.0",
  },
  overlayPackages: {
    "vite-vue": {
      "@tailwindcss/vite": "^4.3.3",
    },
    nuxt: {
      "@tailwindcss/vite": "^4.3.3",
      "shadcn-nuxt": "^2.9.0",
    },
  },
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    "vite-vue": [appendExport("src/lib/utils/index.ts", "./other")],
    nuxt: [
      appendExport("app/lib/utils/index.ts", "./other"),
      {
        file: "nuxt.config.ts",
        pattern: /^/,
        replacement: 'import tailwindcss from "@tailwindcss/vite";\n',
      },
      nuxtModule("shadcn-nuxt"),
      nuxtConfigKeys(
        '  shadcn: {\n    prefix: "",\n    componentDir: "./app/components/ui",\n  },\n  vite: {\n    plugins: [tailwindcss()],\n  },\n',
      ),
    ],
  },
});
