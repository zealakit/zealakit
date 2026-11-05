import actionEn from "./locales/en/action.json";
import commonEn from "./locales/en/common.json";
import fieldEn from "./locales/en/field.json";
import messageEn from "./locales/en/message.json";
import actionVi from "./locales/vi/action.json";
import commonVi from "./locales/vi/common.json";
import fieldVi from "./locales/vi/field.json";
import messageVi from "./locales/vi/message.json";

export const locales = ["en", "vi"] as const;
export const defaultLocale = "en";
export const localeCookieName = "NEXT_LOCALE";

export type Locale = (typeof locales)[number];

const enMessages = {
  action: actionEn,
  common: commonEn,
  field: fieldEn,
  message: messageEn,
};

export type Messages = typeof enMessages;

const messages = {
  en: enMessages,
  vi: {
    action: actionVi,
    common: commonVi,
    field: fieldVi,
    message: messageVi,
  },
} satisfies Record<Locale, Messages>;

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

export function getMessages(locale: Locale) {
  return messages[locale];
}
