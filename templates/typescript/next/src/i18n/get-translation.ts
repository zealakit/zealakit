import { getTranslations } from "next-intl/server";
import { createTranslation, type TranslationNamespace } from "./translation";

export { getLocale } from "next-intl/server";

export async function getTranslation<const Namespaces extends readonly TranslationNamespace[]>(
  namespaces: Namespaces,
) {
  const translate = await getTranslations();
  return createTranslation(translate, namespaces);
}
