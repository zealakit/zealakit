import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, sessionDrivers } from "astro/config";
import { defaultLocale, locales } from "./src/i18n/config.ts";

// https://astro.build/config
export default defineConfig({
  // Used for absolute canonical / Open Graph URLs. Replace with your production domain.
  site: "https://example.com",
  // Server-first hybrid: Actions, sessions, middleware, and server islands need a live runtime.
  // Opt individual routes back to static with `export const prerender = true`.
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  session: {
    // In-memory LRU — fine for local/dev. Prefer Redis / durable storage in production.
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
      // Manual redirect in src/pages/index.astro — avoids `/` route conflict on static builds.
      redirectToDefaultLocale: false,
    },
  },
});
