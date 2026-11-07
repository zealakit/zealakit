import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import("@sveltejs/kit").Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      "@": "src",
    },
    // SPA mode: client-side rendering with a static fallback for file-based routes.
    // `fallback` is the generated file under `build/`, not the source shell.
    // SvelteKit renders `src/app.html` and adapter-static writes `build/index.html`.
    adapter: adapter({ fallback: "index.html" }),
  },
};

export default config;
