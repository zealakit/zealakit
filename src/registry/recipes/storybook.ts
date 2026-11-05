import { defineRecipe } from "./define.js";

export default defineRecipe({
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
    "astro-react-client": {
      storybook: "^10.6.5",
      "@storybook/react-vite": "^10.6.5",
    },
    "astro-react-hybrid": {
      storybook: "^10.6.5",
      "@storybook/react-vite": "^10.6.5",
    },
    next: {
      storybook: "^10.6.5",
      "@storybook/nextjs": "^10.6.5",
    },
    "vite-vue": {
      storybook: "^10.6.5",
      "@storybook/vue3-vite": "^10.6.5",
    },
    nuxt: {
      storybook: "^10.6.5",
      "@storybook/vue3-vite": "^10.6.5",
    },
  },
  devDependencies: {},
  scripts: {
    storybook: "storybook dev -p 6006",
    "build-storybook": "storybook build",
  },
});
