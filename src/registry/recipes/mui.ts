import { defineRecipe, nextUiProviders, viteReactAppProvider } from "./define.js";

export default defineRecipe({
  id: "mui",
  name: "MUI",
  category: "ui",
  supportedScopes: ["client", "hybrid"],
  frameworks: ["react"],
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
    "vite-react": viteReactAppProvider("MuiThemeProvider", "mui-theme-provider"),
    next: nextUiProviders({
      registry: { name: "AppRouterCacheProvider", from: "@mui/material-nextjs/v16-appRouter" },
      theme: { name: "MuiThemeProvider", file: "mui-theme-provider" },
    }),
  },
});
