import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import actionEn from "@/assets/locales/en/action.json";
import commonEn from "@/assets/locales/en/common.json";
import fieldEn from "@/assets/locales/en/field.json";
import messageEn from "@/assets/locales/en/message.json";
import actionVi from "@/assets/locales/vi/action.json";
import commonVi from "@/assets/locales/vi/common.json";
import fieldVi from "@/assets/locales/vi/field.json";
import messageVi from "@/assets/locales/vi/message.json";

const LOCALE_CODES = {
  EN: "en",
  VI: "vi",
} as const;

const LOCALE_STORAGE_KEY = "locale";
const SUPPORTED_LOCALES = [LOCALE_CODES.EN, LOCALE_CODES.VI] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: LocaleCode = LOCALE_CODES.EN;

function isLocale(value: string | null): value is LocaleCode {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const cachedLocale =
  typeof window === "undefined" ? null : localStorage.getItem(LOCALE_STORAGE_KEY);
const initialLocale: LocaleCode = isLocale(cachedLocale) ? cachedLocale : DEFAULT_LOCALE;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      action: typeof actionEn;
      common: typeof commonEn;
      field: typeof fieldEn;
      message: typeof messageEn;
    };
  }
}

void i18n.use(LanguageDetector).init({
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: "common",
  supportedLngs: [...SUPPORTED_LOCALES],
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  detection: {
    lookupLocalStorage: LOCALE_STORAGE_KEY,
    caches: ["localStorage"],
  },
  resources: {
    [LOCALE_CODES.EN]: {
      action: actionEn,
      common: commonEn,
      field: fieldEn,
      message: messageEn,
    },
    [LOCALE_CODES.VI]: {
      action: actionVi,
      common: commonVi,
      field: fieldVi,
      message: messageVi,
    },
  },
});

/** Reactive current locale for Svelte components. */
export const locale = $state<{ current: LocaleCode }>({ current: initialLocale });

export function setLocale(next: LocaleCode): void {
  locale.current = next;
  void i18n.changeLanguage(next);
}

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Leaves<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

/** Typed keys for the namespaces shipped with this template. */
export type TranslationKey =
  | Leaves<typeof commonEn>
  | `action:${Leaves<typeof actionEn>}`
  | `field:${Leaves<typeof fieldEn>}`
  | `message:${Leaves<typeof messageEn>}`;

/** Translate a key using the current reactive locale. */
export function translate(key: TranslationKey): string {
  // i18next's overloads require a literal key at the call site; the public
  // signature above is the typed surface for this template.
  return i18n.t(key as never, { lng: locale.current }) as string;
}
