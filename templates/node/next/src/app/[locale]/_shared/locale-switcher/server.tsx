import { getLocale } from "@/i18n/get-translation";
import { LocaleSwitcherTemplate } from "./template";

/** SSR export — use when the switcher is part of SEO / first-paint chrome. */
export async function LocaleSwitcher() {
  const locale = await getLocale();
  return <LocaleSwitcherTemplate activeLocale={locale} />;
}
