import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../app/**/*.mdx", "../app/**/*.stories.@(js|jsx|mjs|ts|tsx|vue)"],
  addons: [],
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
};

export default config;
