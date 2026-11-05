/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Base URL of the headless CMS / BFF that serves `/articles/:slug`. */
  readonly CMS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
