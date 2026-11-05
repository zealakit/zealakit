"use client";

import { useLocale } from "@/i18n/use-translations";
import { LocaleSwitcherTemplate } from "./template";

/** CSR export — use when the switcher sits inside a client island. */
export function LocaleSwitcher() {
  const locale = useLocale();
  return <LocaleSwitcherTemplate activeLocale={locale} />;
}
