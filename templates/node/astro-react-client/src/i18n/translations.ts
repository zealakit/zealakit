import type { Locale } from "./config";
import en from "./locales/en/common.json";
import vi from "./locales/vi/common.json";

const translations = { en, vi } as const;

export type Translations = (typeof translations)[Locale];

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}
