import type { HomeHeroBannerData } from "../../_handlers";
import { Link } from "@/i18n/navigation";
import styles from "./home-hero-banner.module.css";

type HeroBannerTemplateProps = HomeHeroBannerData;

export function HeroBannerTemplate({
  title,
  description,
  ctaLabel,
  ctaHref,
}: HeroBannerTemplateProps) {
  return (
    <section className={styles.root}>
      <p className={styles.eyebrow}>home / hero-banner</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <Link className={styles.cta} href={ctaHref}>
        {ctaLabel}
      </Link>
    </section>
  );
}
