import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sessionDrivers } from "astro/config";
import { defaultLocale, locales } from "./src/i18n/config.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  session: {
    driver: sessionDrivers.lruCache({
      max: 1000,
    }),
  },
  integrations: [react()],
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
