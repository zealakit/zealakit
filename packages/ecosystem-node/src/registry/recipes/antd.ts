import { defineRecipe, nextUiProviders, viteReactAppProvider } from "./define.js";

export default defineRecipe({
  id: "antd",
  name: "Ant Design",
  category: "ui",
  supportedScopes: ["client", "hybrid"],
  uiFrameworks: ["react"],
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
    "vite-react": viteReactAppProvider("AntdThemeProvider", "antd-theme-provider"),
    next: nextUiProviders({
      registry: { name: "AntdRegistry", from: "@ant-design/nextjs-registry" },
      theme: { name: "AntdThemeProvider", file: "antd-theme-provider" },
    }),
  },
});
