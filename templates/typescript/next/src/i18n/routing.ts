import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./messages";

export const routing = defineRouting({
  locales,
  defaultLocale,
});
