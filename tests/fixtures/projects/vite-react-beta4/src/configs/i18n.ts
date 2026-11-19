import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import actionEn from "@/assets/locales/en/action.json";
import commonEn from "@/assets/locales/en/common.json";
import fieldEn from "@/assets/locales/en/field.json";
import messageEn from "@/assets/locales/en/message.json";
import actionVi from "@/assets/locales/vi/action.json";
import commonVi from "@/assets/locales/vi/common.json";
import fieldVi from "@/assets/locales/vi/field.json";
import messageVi from "@/assets/locales/vi/message.json";
import { apis } from "@/lib/apis";
import type { LocaleCodeModel } from "@/lib/apis/models";
import { CONSTANTS } from "@/lib/constants";

const cacheLanguage =
  typeof window === "undefined" ? null : localStorage.getItem(CONSTANTS.STORAGE.LOCALE);

const initLg = (cacheLanguage || CONSTANTS.LOCALES.CODES.EN) as LocaleCodeModel;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initLg,
    fallbackLng: CONSTANTS.LOCALES.CODES.EN,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      lookupLocalStorage: CONSTANTS.STORAGE.LOCALE,
      caches: ["localStorage"],
    },
    resources: {
      [CONSTANTS.LOCALES.CODES.EN]: {
        action: actionEn,
        common: commonEn,
        field: fieldEn,
        message: messageEn,
      },
      [CONSTANTS.LOCALES.CODES.VI]: {
        action: actionVi,
        common: commonVi,
        field: fieldVi,
        message: messageVi,
      },
    },
  });

if (!cacheLanguage && typeof window !== "undefined") {
  void apis.locale
    .getDefault()
    .then((res) => {
      void i18n.changeLanguage(res.data.id);
    })
    .catch(() => undefined);
}

export default i18n;
