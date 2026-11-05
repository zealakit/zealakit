import styles from "./shared-locale-switcher.module.css";

export function LocaleSwitcherSkeleton() {
  return <div className={`${styles.root} ${styles.skeleton}`} aria-hidden />;
}
