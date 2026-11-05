import styles from "./home-solutions.module.css";

export function SolutionsSkeleton() {
  return (
    <section className={styles.root} aria-hidden>
      <div className={`${styles.skeletonLine} ${styles.skeletonEyebrow}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      <div className={styles.list}>
        <div className={`${styles.skeletonLine} ${styles.skeletonCard}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonCard}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonCard}`} />
      </div>
    </section>
  );
}
