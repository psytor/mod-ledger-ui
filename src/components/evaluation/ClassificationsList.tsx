import type { StatDefinition } from '@/services/gameDataApi';
import { statDisplayName } from './evaluationHelpers';
import styles from './ClassificationsList.module.css';

type Group = {
  label: string;
  swatchColor: string;
  stats: StatDefinition[];
};

interface ClassificationsListProps {
  title: string;
  groups: Group[];
}

export default function ClassificationsList({
  title,
  groups,
}: ClassificationsListProps) {
  const nonEmpty = groups.filter((g) => g.stats.length > 0);
  return (
    <section className={styles.section}>
      <h4 className={styles.head}>{title}</h4>
      {nonEmpty.length === 0 ? (
        <p className={styles.empty}>None marked.</p>
      ) : (
        <div className={styles.groups}>
          {nonEmpty.map((g) => (
            <p key={g.label} className={styles.row}>
              <span className={styles.rowLabel}>
                <span
                  className={styles.swatch}
                  style={{ background: g.swatchColor }}
                  aria-hidden="true"
                />
                {g.label}
              </span>
              <span className={styles.rowList}>
                {g.stats.map((s) => statDisplayName(s)).join(', ')}
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
