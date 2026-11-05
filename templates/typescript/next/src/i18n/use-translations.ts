"use client";

import { useTranslations as useNextIntlTranslations } from "next-intl";
import { createTranslation, type TranslationNamespace } from "./translation";

export { useLocale } from "next-intl";

export function useTranslations<const Namespaces extends readonly TranslationNamespace[]>(
  namespaces: Namespaces,
) {
  const translate = useNextIntlTranslations();
  return createTranslation(translate, namespaces);
}
