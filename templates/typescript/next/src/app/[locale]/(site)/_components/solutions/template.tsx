import type { HomeSolutionsData } from "../../_handlers";
import styles from "./home-solutions.module.css";

type SolutionsTemplateProps = HomeSolutionsData;

export function SolutionsTemplate({ title, items }: SolutionsTemplateProps) {
  return (
    <section className={styles.root}>
      <p className={styles.eyebrow}>home / solutions</p>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <h3 className={styles.itemTitle}>{item.title}</h3>
            <p className={styles.itemDescription}>{item.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
