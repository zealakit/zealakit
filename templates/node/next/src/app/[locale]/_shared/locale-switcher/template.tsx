import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./shared-locale-switcher.module.css";

type LocaleSwitcherTemplateProps = {
  activeLocale: string;
};

export function LocaleSwitcherTemplate({ activeLocale }: LocaleSwitcherTemplateProps) {
  return (
    <nav className={styles.root} aria-label="Locale switcher">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href="/"
          locale={locale}
          className={locale === activeLocale ? `${styles.link} ${styles.active}` : styles.link}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
