import { appendExport, defineRecipe } from "./define.js";

export default defineRecipe({
  id: "shadcn-ui",
  name: "shadcn/ui (core: base-ui | theme: vega | icons: lucide)",
  category: "ui",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["react"],
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
    "astro-react-client": {
      "@tailwindcss/vite": "^4.3.3",
    },
    "astro-react-hybrid": {
      "@tailwindcss/vite": "^4.3.3",
    },
    next: {
      "@tailwindcss/postcss": "^4.3.3",
    },
  },
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    "vite-react": [appendExport("src/lib/utils/index.ts", "./other")],
    "astro-react-client": [appendExport("src/lib/utils/index.ts", "./other")],
    "astro-react-hybrid": [appendExport("src/lib/utils/index.ts", "./other")],
  },
});
