import type { RecipeFileTransform } from "@zealakit/core/ecosystem";
import { defineRecipe } from "./define.js";

/** Add the Vitest config to the project's node tsconfig so editors type-check it. */
const includeVitestConfig: RecipeFileTransform = {
  file: "tsconfig.node.json",
  json: (data) => {
    const include = Array.isArray(data.include) ? (data.include as string[]) : [];
    if (!include.includes("vitest.config.ts")) include.push("vitest.config.ts");
    data.include = include;
  },
};

const REACT = {
  vitest: "^5.1.1",
  jsdom: "^31.0.1",
  "@testing-library/react": "^16.3.3",
  "@testing-library/jest-dom": "^7.0.1",
  "@testing-library/user-event": "^14.6.12",
};

export default defineRecipe({
  id: "vitest",
  discovery: { capabilities: [], projectTypes: ["ui"] },
  name: "Vitest",
  hint: "Unit and component tests",
  category: "testing",
  supportedScopes: ["client", "hybrid"],
  exclusive: false,
  overlayDevDependencies: {
    "vite-react": REACT,
    "astro-react-client": { ...REACT, "@vitejs/plugin-react": "^6.2.1" },
    "astro-react-hybrid": { ...REACT, "@vitejs/plugin-react": "^6.2.1" },
    next: { ...REACT, "@vitejs/plugin-react": "^6.2.1" },
    "vite-vue": { vitest: "^5.1.1", jsdom: "^31.0.1", "@vue/test-utils": "^2.6.0" },
    nuxt: {
      vitest: "^5.1.1",
      "@nuxt/test-utils": "^4.4.0",
      "@vue/test-utils": "^2.6.0",
      "happy-dom": "^21.0.4",
    },
    "vite-svelte": {
      vitest: "^5.1.1",
      jsdom: "^31.0.1",
      "@testing-library/svelte": "^5.4.2",
      "@testing-library/jest-dom": "^7.0.1",
      "@testing-library/user-event": "^14.6.12",
    },
  },
  scripts: {
    test: "vitest run",
    "test:watch": "vitest",
  },
  fileTransforms: {
    "vite-react": [includeVitestConfig],
    "vite-vue": [includeVitestConfig],
  },
});
