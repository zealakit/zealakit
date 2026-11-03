// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
  modules: [
    "@nuxtjs/i18n",
    // zealakit-modules
  ],
  i18n: {
    defaultLocale: "en",
    strategy: "prefix_except_default",
    locales: [
      {
        code: "en",
        name: "English",
        language: "en-US",
        file: "en.ts",
      },
      {
        code: "vi",
        name: "Tiếng Việt",
        language: "vi-VN",
        file: "vi.ts",
      },
    ],
  },
  css: ["~/assets/css/main.css"],
});
