import styles from "./home-hero-banner.module.css";

export function HeroBannerSkeleton() {
  return (
    <section className={styles.root} aria-hidden>
      <div className={`${styles.skeletonLine} ${styles.skeletonEyebrow}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonDescription}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonCta}`} />
    </section>
  );
}
