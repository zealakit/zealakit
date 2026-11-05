/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Base URL of the headless CMS / BFF that serves `/articles/:slug`. */
  readonly CMS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    /** Correlation id set by middleware for every request. */
    requestId: string;
  }

  interface SessionData {
    /** Demo session counter updated by middleware / actions. */
    visitCount: number;
    /** Optional display name set via the sample Astro Action. */
    displayName?: string;
  }
}
