import type { CONSTANTS } from "@/lib/constants";

export type LocaleCodeModel =
  (typeof CONSTANTS.LOCALES.CODES)[keyof typeof CONSTANTS.LOCALES.CODES];

export type GetDefaultLocaleOutput = ApiGeneralResponse<{
  id: LocaleCodeModel;
}>;
