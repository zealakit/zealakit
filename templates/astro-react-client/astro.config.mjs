import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { defaultLocale, locales } from "./src/i18n/config.ts";

// https://astro.build/config
export default defineConfig({
  // Used for absolute canonical / Open Graph URLs. Replace with your production domain.
  site: "https://example.com",
  // Default `static` still allows selective SSR via `export const prerender = false` when an adapter is set.
  adapter: node({
    mode: "standalone",
  }),
  integrations: [react()],
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: true,
      // Manual redirect in src/pages/index.astro — avoids `/` route conflict on static builds.
      redirectToDefaultLocale: false,
    },
  },
});
