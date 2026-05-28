import type { StatDefinition } from '@/services/gameDataApi';
import { formatRollAt, statDisplayName, type TierView } from './evaluationHelpers';
import styles from './RollTargetsList.module.css';

interface RollTargetsListProps {
  // Stored efficiencies in [0, 1]; missing stats are omitted from the list.
  values: Record<number, number>;
  secondaryStats: StatDefinition[];
  tierView: TierView;
}

export default function RollTargetsList({
  values,
  secondaryStats,
  tierView,
}: RollTargetsListProps) {
  const rows = secondaryStats.filter(
    (s) => values[s.stat_id] !== undefined
  );

  if (rows.length === 0) {
    return <p className={styles.empty}>No roll targets set.</p>;
  }

  return (
    <ul className={styles.list}>
      {rows.map((stat) => {
        const efficiency = values[stat.stat_id];
        const percent = Math.round(efficiency * 100);
        const rollText = formatRollAt(stat, efficiency, tierView);
        return (
          <li key={stat.stat_id} className={styles.row}>
            <span className={styles.name}>{statDisplayName(stat)}</span>
            <span className={styles.value}>
              {percent}%
              {rollText !== null && (
                <span className={styles.approx}> (≈{rollText})</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
