/** Keep in sync with `i18n` in `astro.config.mjs`. */
export const locales = ["en", "vi"] as const;
export const defaultLocale = "en";

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
